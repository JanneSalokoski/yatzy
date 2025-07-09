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

    for (let i = 0; i < die_roll_amount(); i++) {
        const value = die_throw();
        die.innerHTML = faces[value - 1];

        const svg = die.querySelector("svg");

        await delay(die_roll_time() * 10);

        svg.classList.add("fade-in");
    }

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
        });
    });

    return dice;
}

async function init() {
    const die_faces = await Promise.all(load_die_faces());
    const dice = get_dice();

    const throw_button = document.getElementById("throw");
    throw_button.onclick = (e) => {
        e.preventDefault();
        dice.forEach(die => throw_die(die, die_faces));
    }
}

window.addEventListener("DOMContentLoaded", () => {
    init();
});
