const MAX_THROWS = 3;
const DIE_COUNT = 5;

const SLOTS = [
    "ones",
    "twos",
    "threes",
    "fours",
    "fives",
    "sixes",
    "pair",
    "three-of-a-kind",
    "four-of-a-kind",
    "two-pairs",
    "small-flush",
    "big-flush",
    "full-house",
    "random",
    "yatzy",
]

function sum(list) {
    // Sum an array of numbers together
    return list.reduce((total, a) => total + a, 0);
}

export function rng(min, max) {
    // Returns a random number generator for the
    // inclusive range between min and max

    const min_ceil = Math.ceil(min);
    const max_floor = Math.floor(max);

    return () => Math.floor(
        Math.random() * (max_floor - min_ceil + 1) + min_ceil
    );
}



class Die {
    // A class implementing the logic of a single D6 die
    constructor() {
        this.value = undefined;
        this.locked = false;
        this.rng = rng(1, 6);
    }

    throw() {
        // Simulate throwing the die
        // Sets the value of the die to a random integer
        // between 1 and 6 if the die is not locked

        if (this.locked) {
            return; // Return early if the die is locked
        }

        this.value = this.rng();
    }

    toggle() {
        this.locked = !this.locked;
    }
}

class Player {
    // A class representing a player and their scores

    constructor(name) {
        this.name = name;
        this._scores = {}

        this._init_scores();
    }

    _init_scores() {
        // Initializes `this._scores` with all the keys from
        // `SLOTS` as undefined

        SLOTS.forEach(slot => this._scores[slot] = undefined);
    }

    set_score(slot, value) {
        // Set a slot in the scores of the player to value
        //
        // Can fail if slot is incorrect or value is not in range

        if (!Object.keys(this._scores).includes(slot)) {
            throw new ReferenceError(`Slot '${slot}' does not exist`);
        }

        if (typeof value !== "number") {
            throw new TypeError(`Value '${value}' is not a number`);
        }

        if (value > 50 || value < 0 || isNaN(value)) {
            throw new RangeError(`Value '${value}' is not in range 0-50`);
        }

        this._scores[slot] = value;
    }

    get_score(slot) {
        if (!Object.prototype.hasOwnProperty.call(this._scores, slot)) {
            console.error("Known slots:", Object.keys(this._scores));
            console.error("Tried slot:", slot);
            throw new ReferenceError(`Slot '${slot}' does not exist`);
        }

        return this._scores[slot];
    }


    load_scores_from_json(json_data) {
        // Tries to set a score slot for every key in `json_data`
        // Will fail if `json_data` can't be parsed or if 
        // `this.set_score` fails

        try {
            const data = JSON.parse(json_data)
            Object.keys(data).forEach(key => {
                this.set_score(key, data[key]);
            })
        }
        catch (error) {
            console.error("Error", error);
            console.error("Json data", json_data);

            throw new Error("Unexpected exception");
        }
    }

    get_json_scores() {
        // Returns the `this._scores` as a JSON string

        return JSON.stringify(this._scores);
    }
}

function get_group_total(length, values) {
    // Returns the total of the largest group of length
    // in the values

    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);

    const valid = Object.entries(counts)
        .filter(([_, count]) => count >= length)
        .map(([num]) => parseInt(num));

    return valid.length ? Math.max(...valid) * length : 0;
}


function is_straight(values, expected) {
    // Returns true if the values form a straight spanning
    // the expected values

    const sorted = [...values].sort((a, b) => a - b);

    return sorted.length === expected.length &&
        sorted.every((v, i) => v === expected[i]);
}

const scoreMap = {
    "ones": vals => vals.filter(v => v === 1).length,
    "twos": vals => vals.filter(v => v === 1).length * 2,
    "threes": vals => vals.filter(v => v === 1).length * 3,
    "fours": vals => vals.filter(v => v === 1).length * 4,
    "fives": vals => vals.filter(v => v === 1).length * 5,
    "sixes": vals => vals.filter(v => v === 1).length * 6,

    "pair": vals => get_group_total(2, vals),
    "three-of-a-kind": vals => get_group_total(3, vals),
    "four-of-a-kind": vals => get_group_total(4, vals),

    "small-flush": vals => is_straight(vals, [1, 2, 3, 4, 5]) ? 15 : 0,
    "big-flush": vals => is_straight(vals, [2, 3, 4, 5, 6]) ? 20 : 0,

    "full-house": vals => {
        const threes = get_group_total(3, vals);
        if (!threes) {
            return 0;
        }

        const three_val = threes / 3;
        const pair_vals = vals.filter(v => v !== three_val);

        const pair = get_group_total(2, pair_vals);

        return pair ? pair + threes : 0;
    },

    "random": vals => sum(vals),
    "yatzy": vals => vals.every(v => v === vals[0]) ? 50 : 0
};

export function calculate_score(slot, values) {
    return scoreMap[slot]?.(values) ?? 0;
}

export class GameLogic {
    // A class implementing the game logic of yatzy

    constructor() {
        this.status = "pending";

        this.players = [];
        this.current_player = undefined;

        this.throws_left = MAX_THROWS;
        this.dice = this._init_dice(DIE_COUNT);
    }

    _init_dice(count) {
        return Array.from({ length: count }, () => new Die())
    }

    add_player(name) {
        this.players.push(new Player(name));
    }


    _filter_die_values(filter = () => true) {
        return this.dice
            .filter(filter)
            .map(d => d.value)
    }

    get _die_values() {
        return this._filter_die_values();
    }

    start_game() {
        if (this.status !== "pending") {
            throw new Error("Can't start a game that has already been started");
        }

        if (this.players.length < 2) {
            throw new Error("Can't start a game with less than 2 players");
        }

        this.current_player = 0;
        this.status = "started"
    }

    _roll_dice() {
        this.dice.forEach(d => d.throw());
        return this._die_values;
    }

    _allocate(slot) {
        const player = this.players[this.current_player];
        const values = this._die_values;
        const score = calculate_score(slot, values);
        player.set_score(slot, score);

        this.throws_left = MAX_THROWS;
        this.dice.forEach(d => {
            d.value = undefined;
            d.locked = false;
        });

        this.current_player = (this.current_player + 1) % this.players.length;
    }


    *_turn_generator() {
        let rolls = 0;
        let rolled_once = false;

        while (rolls < MAX_THROWS) {
            yield {
                roll: () => {
                    rolls++;
                    rolled_once = true;
                    return { values: this._roll_dice(), done: false };
                },
                allocate: rolled_once
                    ? (slot) => {
                        this._allocate(slot);
                        return { done: true };
                    }
                    : null
            };
        }

        // Final step: only allocation allowed
        yield {
            roll: null,
            allocate: (slot) => {
                this._allocate(slot);
                return { done: true };
            }
        };
    }




    start_turn() {
        this._turn = this._turn_generator();
        this._step = this._turn.next();
    }

    take_roll() {
        if (!this._step || typeof this._step.value.roll !== "function") {
            throw new Error("Roll not allowed");
        }

        const result = this._step.value.roll();
        this.throws_left = Math.max(this.throws_left - 1, 0);
        this._step = this._turn.next();
        return result.values;
    }

    allocate_slot(slot) {
        if (!this._step || typeof this._step.value.allocate !== "function") {
            throw new Error("No allocation available");
        }

        const result = this._step.value.allocate(slot);
        this._step = null;

        return result.done;
    }

    can_roll() {
        return !!this._step?.value?.roll;
    }

    can_allocate() {
        return !!this._step?.value?.allocate;
    }
}


export function test() {
    const game = new GameLogic();

    game.add_player("Player A");
    game.add_player("Player B");

    game.start_game();

    game.start_turn();           // Initializes turn
    game.take_roll(); // First roll
    game.take_roll();     // Second roll
    game.take_roll();     // Third roll

    game.allocate_slot("fours"); // Allocates and ends turn

    game.start_turn();           // Initializes turn
    game.take_roll(); // First roll
    game.take_roll();     // Second roll
    game.take_roll();     // Third roll

    game.allocate_slot("fives"); // Allocates and ends turn

    console.log(game.players[0]._scores["fours"]);
    console.log(game.players[1]._scores["fives"]);
}
