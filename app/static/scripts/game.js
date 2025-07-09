let my_turn = true;

let throws_left = 3;

let curr_score = 0;

let die_values = {
    "die-1": { value: 0, locked: false },
    "die-2": { value: 0, locked: false },
    "die-3": { value: 0, locked: false },
    "die-4": { value: 0, locked: false },
    "die-5": { value: 0, locked: false },
};

let selected_slot = "";

const slot_names = {
    "ones": "ykköset",
    "twos": "kakkoset",
    "threes": "kolmoset",
    "fours": "neloset",
    "fives": "vitoset",
    "sixes": "kutoset",
    "pair": "pari",
    "three-of-a-kind": "kolme samaa",
    "four-of-a-kind": "neljä samaa",
    "two-pairs": "kaksi paria",
    "small-flush": "pieni suora",
    "big-flush": "iso suora",
    "full-house": "täyskäsi",
    "random": "sattuma",
    "yatzy": "yatzy",
}

async function load_svg(face) {
    const res = await fetch(`/static/svg/die-${face}.svg`);
    return await res.text();
}

function load_die_faces() {
    return [
        load_svg(1),
        load_svg(2),
        load_svg(3),
        load_svg(4),
        load_svg(5),
        load_svg(6)
    ]
}

function random_range(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);

    return () => {
        return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

const die_roll_amount = random_range(1, 10);
const die_roll_time = random_range(5, 20);
const die_throw = random_range(1, 6);

async function throw_die(die, faces) {
    if (die.classList.contains("selected")) {
        return;
    }

    die.classList.add("rolling");

    let value = 1;
    for (let i = 0; i < die_roll_amount(); i++) {
        value = die_throw();

        die.innerHTML = faces[value - 1];
        const svg = die.querySelector("svg");

        await delay(die_roll_time() * 10);

        svg.classList.add("fade-in");
    }

    die_values[die.id].value = value;
    die.classList.remove("rolling");
}

function get_dice() {
    const dice = [
        document.getElementById("die-1"),
        document.getElementById("die-2"),
        document.getElementById("die-3"),
        document.getElementById("die-4"),
        document.getElementById("die-5")
    ];

    dice.forEach(die => {
        die.addEventListener("click", () => {
            die.classList.toggle("selected");
            die_values[die.id].locked = !die_values[die.id].locked;
            update_stats();
        });
    });

    return dice;
}

function get_group_total(length, values) {
    const counts = {};
    values.forEach(v => counts[v] = (counts[v] || 0) + 1);

    let groups = Object.entries(counts)
        .filter(([num, count]) => count >= length)
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
    console.log(slot, values);
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


function update_stats() {
    const throws_element = document.querySelector(".throws-left .value");
    const selected_element = document.querySelector(".selected .value");
    const sum_element = document.querySelector(".sum .value");
    const locked_sum_element = document.querySelector(".locked-sum .value");
    const max_sum_element = document.querySelector(".max-sum .value");
    const score_element = document.querySelector(".score .value");

    const selected_slot_name = slot_names[selected_slot];

    const sum = Object.values(die_values)
        .map(val => val.value)
        .reduce((total, val) => total + val, 0);

    const locked_sum = Object.values(die_values)
        .filter(v => v.locked === true)
        .map(val => val.value)
        .reduce((total, val) => total + val, 0);

    const free = Object.values(die_values)
        .filter(v => v.locked === false)
        .length;

    const max_sum = locked_sum + free * 6;

    const current_score = calculate_score(selected_slot,
        Object.values(die_values)
            .map(val => val.value)
    )

    curr_score = current_score;

    throws_element.textContent = throws_left;
    selected_element.textContent = selected_slot_name;
    sum_element.textContent = sum;
    locked_sum_element.textContent = locked_sum;
    max_sum_element.textContent = max_sum;
    score_element.textContent = current_score;
}

function get_rows() {
    return document.querySelectorAll(".row");
}

async function init() {
    const die_faces = await Promise.all(load_die_faces());
    const dice = get_dice();

    update_stats();

    const throw_button = document.getElementById("throw");
    throw_button.onclick = async (e) => {
        e.preventDefault();

        await Promise.all(dice.map(die => throw_die(die, die_faces)));

        throws_left = Math.max(0, throws_left - 1);
        if (throws_left === 0) {
            throw_button.disabled = true;
        }

        update_stats();

    }

    const rows = get_rows();
    rows.forEach(row => {
        row.addEventListener("click", () => {
            console.log(row);
            selected_slot = row.id !== selected_slot ? row.id : "";
            rows.forEach(r => {
                if (r.id == selected_slot) {
                    r.classList.add("selected");
                } else {
                    r.classList.remove("selected");
                }
            });
            update_stats();
        })
    })

    const allocate_button = document.querySelector("#allocate");
    allocate_button.onclick = () => {
        const selected_row = document.querySelector(`.row.${selected_slot}`);
        selected_row.querySelector(".score").textContent = curr_score;

        throws_left = 3;
        throw_button.disabled = false;
    }
}

window.addEventListener("DOMContentLoaded", () => {
    init();
});
