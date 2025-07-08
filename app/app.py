from flask import Flask, redirect, render_template, request, session, g

import os
import psycopg2

app = Flask(__name__)


def get_db():
    if "db" not in g:
        g.db = psycopg2.connect(os.environ["DATABASE_URL"])

    return g.db


def db_cursor(func):
    def wrapper(*args, **kwargs):
        conn = get_db()
        cur = conn.cursor()
        res = func(*args, **kwargs, cur=cur)
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


@db_cursor
@app.route("/status")
def status(cur):
    cur.execute("SELECT version();")
    db_version = cur.fetchone()

    return f"Connected to DB: {db_version[0]}"


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
