let die_values = {
    "die-1": { value: 0, locked: false },
    "die-2": { value: 0, locked: false },
    "die-3": { value: 0, locked: false },
    "die-4": { value: 0, locked: false },
    "die-5": { value: 0, locked: false },
};

let selected_slot = "";

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

function update_stats() {
    const sum_element = document.querySelector(".sum .value");
    const locked_sum_element = document.querySelector(".locked-sum .value");
    const max_sum_element = document.querySelector(".max-sum .value");

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

    sum_element.textContent = sum;
    locked_sum_element.textContent = locked_sum;
    max_sum_element.textContent = max_sum;
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
        update_stats();
    }

    const rows = get_rows();
    rows.forEach(row => {
        row.addEventListener("click", () => {
            selected_slot = row.id !== selected_slot ? row.id : "";
            rows.forEach(r => {
                if (r.id == selected_slot) {
                    r.classList.add("selected");
                } else {
                    r.classList.remove("selected");
                }
            })
        })
    })
}

window.addEventListener("DOMContentLoaded", () => {
    init();
});
