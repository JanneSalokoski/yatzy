const MAX_THROWS = 3;
const DICE_COUNT = 5;

function sum(list) {
    return list.reduce((total, a) => total + a, 0);
}

function random_range(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return () => Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

class DieFaceLoader {
    static async loadAll() {
        return Promise.all(
            Array.from({ length: 6 }, (_, i) =>
                fetch(`/static/svg/die-${i + 1}.svg`).then(res => res.text())
            )
        );
    }
}

class Die {
    constructor(element, game) {
        this.element = element;
        this.game = game;
        this.value = 0;
        this.locked = false;

        this.element.addEventListener("click", () => {
            this.locked = !this.locked;
            this.element.classList.toggle("selected", this.locked);
            this.game.update_stats();
        });
    }

    async throw() {
        if (this.locked) return;

        this.element.classList.add("rolling");

        let value = 0;
        const amount = this.game._roll_amount_rng();
        const time_rng = this.game._roll_time_rng;

        for (let i = 0; i < amount; i++) {
            value = this.game._roll_value_rng();
            this.element.innerHTML = this.game.die_faces[value - 1];

            const svg = this.element.querySelector("svg");
            svg?.classList.add("fade-in");

            await delay(time_rng() * 10);
        }

        this.value = value;
        this.element.classList.remove("rolling");
    }
}

function get_group_total(length, values) {
    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);

    const valid = Object.entries(counts)
        .filter(([_, count]) => count >= length)
        .map(([num]) => parseInt(num));

    return valid.length ? Math.max(...valid) * length : 0;
}

function is_straight(values, expected) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted.length === expected.length &&
        sorted.every((v, i) => v === expected[i]);
}

const scoreFunctions = {
    ones: vals => vals.filter(v => v === 1).length,
    twos: vals => vals.filter(v => v === 2).length * 2,
    threes: vals => vals.filter(v => v === 3).length * 3,
    fours: vals => vals.filter(v => v === 4).length * 4,
    fives: vals => vals.filter(v => v === 5).length * 5,
    sixes: vals => vals.filter(v => v === 6).length * 6,
    pair: vals => get_group_total(2, vals),
    'three-of-a-kind': vals => get_group_total(3, vals),
    'four-of-a-kind': vals => get_group_total(4, vals),
    'full-house': vals => {
        const three = get_group_total(3, vals);
        if (!three) return 0;
        const three_val = three / 3;
        const pair_vals = vals.filter(v => v !== three_val);
        const pair = get_group_total(2, pair_vals);
        return pair ? pair + three : 0;
    },
    'small-flush': vals => is_straight(vals, [1, 2, 3, 4, 5]) ? 15 : 0,
    'big-flush': vals => is_straight(vals, [2, 3, 4, 5, 6]) ? 20 : 0,
    random: vals => sum(vals),
    yatzy: vals => vals.every(v => v === vals[0]) ? 50 : 0,
};

function calculate_score(slot, values) {
    return scoreFunctions[slot]?.(values) ?? 0;
}

function update_stats_element(element, value) {
    element.querySelector(".value").textContent = value;
}

class Game {
    constructor(players = 1) {
        this.players = players;
        this.throws_left = MAX_THROWS;
        this.my_turn = true;
        this.selected_slot = "";
        this.current_score = 0;

        this._roll_amount_rng = random_range(1, 10);
        this._roll_time_rng = random_range(5, 20);
        this._roll_value_rng = random_range(1, 6);

        this.dice = this._init_dice(DICE_COUNT);
    }

    async init() {
        this.die_faces = await DieFaceLoader.loadAll();
        this.stats_elements = this._init_stats_elements();

        this._init_rows();
        this._init_buttons();
        this.update_stats();
    }

    _init_dice(count) {
        return Array.from({ length: count }, (_, i) =>
            new Die(document.getElementById(`die-${i + 1}`), this)
        );
    }

    _init_stats_elements() {
        const elements = {};
        document.querySelectorAll(".stats li").forEach(li => {
            elements[li.className] = li;
        });
        return elements;
    }

    _init_rows() {
        const rows = document.querySelectorAll(".row");

        rows.forEach(row => {
            row.addEventListener("click", () => {
                this.selected_slot = (row.id !== this.selected_slot) ? row.id : "";

                rows.forEach(r => {
                    r.classList.toggle("selected", r.id === this.selected_slot);
                });

                this.update_stats();
            });
        });
    }

    _init_buttons() {
        const throw_btn = document.getElementById("throw");
        const allocate_btn = document.getElementById("allocate");

        throw_btn.onclick = async (e) => {
            e.preventDefault();
            if (this.throws_left <= 0) return;

            await Promise.all(this.dice.map(d => d.throw()));
            this.throws_left = Math.max(0, this.throws_left - 1);

            throw_btn.disabled = this.throws_left === 0;
            this.update_stats();
        };

        allocate_btn.onclick = () => {
            const row = document.querySelector(`.row.${this.selected_slot}`);
            if (row) {
                row.querySelector(".score").textContent = this.current_score;
            }

            this.reset_turn();
        };
    }

    reset_turn() {
        this.throws_left = MAX_THROWS;
        this.selected_slot = "";
        this.current_score = 0;

        this.dice.forEach(die => {
            die.locked = false;
            die.element.classList.remove("selected");
        });

        document.getElementById("throw").disabled = false;
        this.update_stats();
    }

    die_values(filter = () => true) {
        return this.dice.filter(filter).map(d => d.value);
    }

    update_stats() {
        const all = this.die_values();
        const locked = this.die_values(d => d.locked);
        const free = this.die_values(d => !d.locked);

        const statMap = {
            "throws-left": this.throws_left,
            "selected-slot": this.selected_slot || "—",
            "total-sum": sum(all),
            "locked-sum": sum(locked),
            "max-sum": sum(locked) + free.length * 6,
            "score": calculate_score(this.selected_slot, all),
        };

        this.current_score = statMap["score"];

        for (const [key, val] of Object.entries(statMap)) {
            update_stats_element(this.stats_elements[key], val);
        }
    }
}

async function init() {
    const game = new Game();
    await game.init();
}

window.addEventListener("DOMContentLoaded", init);
