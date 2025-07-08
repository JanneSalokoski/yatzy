from flask import Flask, redirect, render_template, request, session, g, url_for

import os
import psycopg2
import psycopg2.extras
import hashlib
import bcrypt
import functools

app = Flask(__name__)


def create_slug(text: str) -> str:
    return hashlib.md5(text.encode()).hexdigest()[:8]


def get_db():
    if "db" not in g:
        g.db = psycopg2.connect(
            os.environ["DATABASE_URL"], cursor_factory=psycopg2.extras.RealDictCursor
        )

    return g.db


def db_cursor(func):
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        conn = get_db()
        cur = conn.cursor()
        res = func(*args, **kwargs, cur=cur, conn=conn)
        cur.close()
        return res

    return wrapper


@app.teardown_appcontext
def close_db(error):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@app.route("/")
def index():
    return render_template("home.html", page_title="Etusivu")


@app.route("/player", methods=["GET", "POST"])
@app.route("/player/<string:player_slug>", methods=["GET", "POST"])
@db_cursor
def create_or_edit_player(cur=None, conn=None, player_slug=None):
    player = None

    if player_slug:
        query = "SELECT id, slug, name FROM players WHERE slug = %s"
        cur.execute(query, (player_slug,))
        player = cur.fetchone()

    if request.method == "POST":
        name = request.form["name"]
        slug = create_slug(name)
        password = request.form["password"]
        hash = bcrypt.hashpw(
            request.form["password"].encode(), bcrypt.gensalt()
        ).decode()

        if player:
            if password:
                query = "UPDATE players SET name = %s, hash = %s WHERE slug = %s"
                cur.execute(query, (name, hash, slug))
            else:
                query = "UPDATE players SET name = %s WHERE slug = %s"
                cur.execute(query, (name,))

        else:
            query = "INSERT INTO players (slug, name, hash) VALUES (%s, %s, %s)"
            cur.execute(query, (slug, name, hash))

        conn.commit()
        return redirect(url_for("create_or_edit_player", player_slug=slug))

    return render_template("player_form.html", player=player)


@app.route("/status")
@db_cursor
def status(cur=None, conn=None):
    cur.execute("SELECT version();")
    db_version = cur.fetchone()

    return f"Connected to DB: {db_version[0]}"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
