import { GameLogic, calculate_score } from './game_logic.js';

function sum(list) {
    return list.reduce((total, a) => total + a, 0);
}

const DIE_FACE_URL = (num) => `/static/svg/die-${num}.svg`;
const DIE_COUNT = 5;

class DieFaceLoader {
    static async loadAll() {
        return Promise.all(
            Array.from({ length: 6 }, (_, i) =>
                fetch(DIE_FACE_URL(i + 1))
                    .then(res => res.text())
            )
        );
    }
}

function update_stats_element(element, value) {
    element.querySelector(".value").textContent = value;
}

export class GameUI {
    constructor() {
        this.game = new GameLogic();

        this.selected_slot = undefined;

        this.status = "pending";
    }

    async init() {
        this.die_faces = await DieFaceLoader.loadAll();
        this.stats_elements = this._init_stats_elements();
        this.dice = this._init_dice(DIE_COUNT);

        this.rows = this._init_rows();
        this._init_buttons();

        this.update_stats();
    }

    _init_dice(count) {
        const die_elements = Array.from({ length: count }, (_, i) =>
            document.getElementById(`die-${i + 1}`)
        );

        die_elements.forEach((d, i) => {
            d.onclick = () => {
                this.game.dice[i].toggle();
                this.update_dice();
            }
        })

        return die_elements;
    }

    _init_stats_elements() {
        const elements = {};
        document.querySelectorAll(".stats li").forEach(li => {
            elements[li.className] = li;
        });
        return elements;
    }

    _init_rows() {
        const rows = document.querySelectorAll(".row.slot");

        rows.forEach(row => {
            row.addEventListener("click", () => {
                const slot_id = row.id;
                const player = this.game.players[this.game.current_player];

                if (player.get_score(slot_id) !== undefined) {
                    return;
                }

                this.selected_slot = (row.id !== this.selected_slot) ? row.id : "";

                rows.forEach(r => {
                    r.classList.toggle("selected", r.id === this.selected_slot);
                });

                this.update_stats();
            });
        });

        return rows;
    }

    _init_buttons() {
        const add_player_btn = document.getElementById("add-player");
        const start_game_btn = document.getElementById("start-game");
        const start_turn_btn = document.getElementById("start-turn");
        const throw_btn = document.getElementById("throw");
        const allocate_btn = document.getElementById("allocate");

        add_player_btn.onclick = () => {
            this.game.add_player(document.getElementById("player-name").value);
            this.update_stats();
        }

        start_game_btn.onclick = () => {
            this.game.start_game();
            this.update_stats();
        }

        start_turn_btn.onclick = () => {
            this.game.start_turn();
            this.update_stats();
        }

        throw_btn.onclick = () => {
            this.game.take_roll();
            this.update_stats();
        }

        allocate_btn.onclick = () => {
            this.game.allocate_slot(this.selected_slot);
            this.update_stats();
        }
    }

    _update_button_states() {
        const add_player_btn = document.getElementById("add-player");
        const start_game_btn = document.getElementById("start-game");
        const start_turn_btn = document.getElementById("start-turn");
        const throw_btn = document.getElementById("throw");
        const allocate_btn = document.getElementById("allocate");

        // Allow adding players only before game starts
        add_player_btn.disabled = this.game.status !== "pending";

        // Start game only if at least 2 players
        start_game_btn.disabled = (
            this.game.status !== "pending" ||
            this.game.players.length < 2
        );

        // Start turn if game started and no turn in progress
        start_turn_btn.disabled = (
            this.game.status !== "started"
        );
        // this.game._step !== null // or a clearer `this.turn_in_progress` flag

        // Allow roll if allowed
        throw_btn.disabled = !this.game.can_roll();

        // Allow allocation if allowed and slot selected
        const active_player = this.game.players[this.game.current_player];
        const slot_already_used = !this.selected_slot || active_player.get_score(this.selected_slot) !== undefined;

        allocate_btn.disabled = !this.game.can_allocate() || !this.selected_slot || slot_already_used;
    }


    update_dice() {
        this.dice.forEach((element, i) => {
            const die = this.game.dice[i];
            if (die.value === undefined) {
                element.innerHTML = "";
            } else {
                element.innerHTML = this.die_faces[die.value - 1];
            }

            element.classList.toggle("locked", die.locked);
        });
    }

    update_grid() {
        if (this.game.status === "pending") {
            return;
        }

        const player_slots = document.querySelectorAll(".row#players .score");
        const subtotal_slots = document.querySelectorAll(".row#subtotal .score");
        const bonus_slots = document.querySelectorAll(".row#bonus .score");
        const total_slots = document.querySelectorAll(".row#total .score");

        const winning_total = Math.max(...this.game.players.map(p => p.total))

        this.game.players.forEach((player, i) => {
            player_slots[i].textContent = player.name;
            subtotal_slots[i].innerHTML = `<span class='value'>${player.subtotal}</span> <span class='extra ${(player.subtotal - 63) >= 0 ? "green" : ""}'>(${player.subtotal - 63})</span>`;
            bonus_slots[i].textContent = player.bonus ? "50" : "";
            total_slots[i].innerHTML = `<span class='value'>${player.total}</span><span class='extra ${(player.total - winning_total) >= 0 ? "green" : ""}'>(${player.total - winning_total})</span>`;

            if (this.game.current_player == i) {
                player_slots[i].classList.add("active");
            } else {
                player_slots[i].classList.remove("active");
            }
        })


        this.rows.forEach((row) => {
            row.querySelectorAll(".cell.score").forEach((cell, i) => {
                const val = this.game.players[i].get_score(row.id);
                if (val === undefined) {
                    cell.textContent = "";
                } else if (val === 0) {
                    cell.textContent = "--";
                } else {
                    cell.textContent = val;
                }

                if (this.game.current_player == i) {
                    cell.classList.add("active");
                } else {
                    cell.classList.remove("active");
                }
            })
        })
    }


    update_stats() {
        const all = this.game._die_values;
        const locked = this.game._filter_die_values(d => d.locked);
        const free = this.game._filter_die_values(d => !d.locked);

        const statMap = {
            "status": this.game.status,
            "players": this.game.players.map(p => p.name).join(", "),
            "active-player": this.game.current_player !== undefined ? this.game.players[this.game.current_player].name : "",
            "throws-left": this.game.throws_left,
            "selected-slot": this.selected_slot || "—",
            "total-sum": sum(all),
            "locked-sum": sum(locked),
            "max-sum": sum(locked) + free.length * 6,
            "score": calculate_score(this.selected_slot, all),
        };

        for (const [key, val] of Object.entries(statMap)) {
            update_stats_element(this.stats_elements[key], val);
        }

        this.update_dice();
        this.update_grid();
        this._update_button_states();
    }
}
