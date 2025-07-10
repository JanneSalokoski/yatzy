function sum(list) {
    return list.reduce((total, a) => total + a, 0);
}

function random_range(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);

    return () =>
        Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function load_svg(face) {
    const res = await fetch(`/static/svg/die-${face}.svg`);
    return await res.text();
}

class Die {
    constructor(element, game) {
        this.value = 0;
        this.locked = false;
        this.element = element;
        this.game = game;

        this.element.addEventListener("click", () => {
            this.element.classList.toggle("selected");
            this.locked = !this.locked;

            this.game.update_stats();
        })
    }


    async throw() {
        if (this.element.classList.contains("selected")) {
            return;
        }

        this.element.classList.add("rolling");

        let value = 0;
        for (let i = 0; i < this.game._roll_amount_rng(); i++) {
            value = this.game._roll_value_rng();

            this.element.innerHTML = this.game.die_faces[value - 1];

            const svg = this.element.querySelector("svg");

            await delay(this.game._roll_time_rng() * 10);

            svg.classList.add("fade-in");
        }

        this.value = value;
        this.element.classList.remove("rolling");
    }
}

function get_group_total(length, values) {
    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);

    let groups = Object.entries(counts)
        .filter(([_, count]) => count >= length)
        .map(([num]) => parseInt(num));

    if (groups.length === 0) return 0;

    return Math.max(...groups) * length;
}

function is_straight(values, expected) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length === expected.length &&
        sorted.every((val, i) => val === expected[i]);
}

function calculate_score(slot, values) {
    switch (slot) {
        case 'ones':
            return values.filter(v => v == 1).length;
        case 'twos':
            return values.filter(v => v == 2).length * 2;
        case 'threes':
            return values.filter(v => v == 3).length * 3;
        case 'fours':
            return values.filter(v => v == 4).length * 4;
        case 'fives':
            return values.filter(v => v == 5).length * 5;
        case 'sixes':
            return values.filter(v => v == 6).length * 6;

        case 'pair':
            return get_group_total(2, values);
        case 'three-of-a-kind':
            return get_group_total(3, values);
        case 'four-of-a-kind':
            return get_group_total(4, values);

        case 'full-house':
            let three = get_group_total(3, values);
            if (three === 0) {
                return 0;
            }

            let three_val = Math.round(three / 3);
            let pair_vals = values.filter(v => v !== three_val);

            let pair = get_group_total(2, pair_vals);

            if (pair === 0) {
                return 0;
            }

            return pair + three;

        case 'small-flush':
            return (is_straight(values, [1, 2, 3, 4, 5])) ? 15 : 0;

        case 'big-flush':
            return (is_straight(values, [2, 3, 4, 5, 6])) ? 20 : 0;

        case 'random':
            return values.reduce((total, v) => total + v);

        case 'yatzy':
            return values.every(v => v === values[1]) ? 50 : 0;

        default:
            return 0;
    }
}

function update_stats_element(element, value) {
    element.querySelector(".value").textContent = value;
}

class Game {
    constructor(players) {
        this.players = players;

        this.throws_left = 3;
        this.my_turn = true;

        this.current_score = 0;
        this.selected_slot = "";

        this.dice = this._init_dice(5);

        this._roll_amount_rng = random_range(1, 10);
        this._roll_time_rng = random_range(5, 20);
        this._roll_value_rng = random_range(1, 6);
    }

    async init() {
        this.die_faces = await this._init_die_faces();
        this.stats_elements = this._init_stats_elements();

        this._init_rows();
        this._init_buttons();
    }

    _init_dice(amount) {
        return Array(amount)
            .fill()
            .map((_, i) => new Die(
                document.getElementById(`die-${i + 1}`),
                this
            ));
    }

    async _init_die_faces() {
        return await Promise
            .all(Array(6)
                .fill()
                .map((_, i) => load_svg(i + 1)));
    }

    _init_stats_elements() {
        let table = {};

        document.querySelectorAll(".stats li")
            .forEach(element => {
                table[element.className] = element;
            })

        return table;
    }

    _init_rows() {
        const rows = document.querySelectorAll(".row");
        rows
            .forEach(row =>
                row.addEventListener("click", () => {
                    this.selected_slot =
                        row.id !== this.selected_slot ? row.id : "";

                    rows.forEach(r => {
                        if (r.id == this.selected_slot) {
                            r.classList.add("selected");
                        } else {
                            r.classList.remove("selected");
                        }
                    });

                    this.update_stats();
                })
            )

    }

    _init_buttons() {
        const throw_btn = document.getElementById("throw");
        const allocate_btn = document.getElementById("allocate");

        throw_btn.onclick = async (e) => {
            e.preventDefault();

            await Promise.all(this.dice.map(d => d.throw()));

            this.throws_left = Math.max(0, this.throws_left - 1);

            if (this.throws_left == 0) {
                throw_btn.disabled = true;
            }

            this.update_stats();
        }

        allocate_btn.onclick = () => {
            const selected_row = document.querySelector(`.row.${this.selected_slot}`);
            selected_row.querySelector(".score").textContent = this.current_score;

            this.throws_left = 3;
            throw_btn.disabled = false;
        }
    }

    die_values(filter = () => true) {
        return this.dice
            .filter(filter)
            .map(d => d.value);
    }

    throw_dice() {
        this.dice.forEach(d => d.throw());
    }

    update_stats() {
        const die_values = this.die_values();
        const locked_die_values = this.die_values((d) => d.locked);
        const free_die_values = this.die_values((d) => !d.locked);

        const total_sum = sum(die_values);
        const locked_sum = sum(locked_die_values);
        const free_amount = free_die_values.length;

        const max_sum = locked_sum + free_amount * 6;

        const current_score = calculate_score(this.selected_slot, die_values);
        this.current_score = current_score;

        update_stats_element(
            this.stats_elements["throws-left"],
            this.throws_left
        );

        update_stats_element(
            this.stats_elements["selected-slot"],
            this.selected_slot
        );
        update_stats_element(this.stats_elements["total-sum"], total_sum);
        update_stats_element(this.stats_elements["locked-sum"], locked_sum);
        update_stats_element(this.stats_elements["max-sum"], max_sum);
        update_stats_element(this.stats_elements["score"], current_score);
    }
}


async function init() {
    const game = new Game();
    await game.init();
}

window.addEventListener("DOMContentLoaded", init);
