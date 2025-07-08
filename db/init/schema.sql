create table games (
    id serial primary key,
    slug text not null,
    created_at timestamp default now(),
    state_json jsonb not null,
    state_version integer not null default 0
);

create table slots (
    id serial primary key,
    name text not null,
    value integer not null
);

insert into slots (name, value)
values
    ('ones', 0),
    ('twos', 0),
    ('threes', 0),
    ('fours', 0),
    ('fives', 0),
    ('sixes', 0),
    ('pair', 0),
    ('two-pairs', 0),
    ('three-of-a-kind', 0),
    ('four-of-a-kind', 0),
    ('small-flush', 0),
    ('big-flush', 0),
    ('full-house', 0),
    ('random', 0),
    ('yatzy', 50)
;

create table players (
    id serial primary key,
    slug text not null,
    name text not null,
    hash text not null,
    created_at timestamp default now()
);

create table moves (
    id serial primary key,
    game_id serial references games(id),
    slot_id serial references slots(id),
    player_id serial references players(id),
    score integer not null,
    created_at timestamp default now()
);
