
/*
 * GARMIN SPORTS DASHBOARD
 *
 * Käynnistys:
 *   node server.js
 *
 * Jos tarvittavat npm-kirjastot puuttuvat,
 * ne asennetaan automaattisesti.
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { spawnSync } = require("child_process");

// AUTOMAATTINEN KIRJASTOJEN ASENNUS

function ensureDependencies() {
    const required = ["express", "dotenv"];

    const missing = required.filter(name => {
        try {
            require.resolve(name);
            return false;
        } catch {
            return true;
        }
    });

    if (!missing.length) {
        return;
    }

    console.log("");
    console.log("Tarvittavia kirjastoja puuttuu:");
    console.log(missing.join(", "));
    console.log("Asennetaan kirjastot automaattisesti...");
    console.log("");

    const packageFile = path.join(
        __dirname,
        "package.json"
    );

    if (!fs.existsSync(packageFile)) {
        console.error(
            "Virhe: package.json puuttuu projektista."
        );
        process.exit(1);
    }

    const command = process.platform === "win32"
        ? "npm.cmd"
        : "npm";

    const result = spawnSync(
        command,
        ["install", "--no-audit", "--no-fund"],
        {
            cwd: __dirname,
            stdio: "inherit",
            shell: process.platform === "win32"
        }
    );

    if (result.error || result.status !== 0) {
        console.error("");
        console.error(
            "Kirjastojen automaattinen asennus epäonnistui."
        );

        if (result.error) {
            console.error(result.error.message);
        }

        process.exit(1);
    }

    // Varmistetaan, että asennus onnistui.
    for (const name of required) {
        try {
            require.resolve(name);
        } catch {
            console.error(
                `Kirjastoa ${name} ei löytynyt asennuksen jälkeen.`
            );
            process.exit(1);
        }
    }

    console.log("");
    console.log("Kirjastot asennettu onnistuneesti!");
    console.log("Käynnistetään Garmin Dashboard...");
    console.log("");
}

ensureDependencies();

// Vasta tämän jälkeen ladataan npm-kirjastot.

require("dotenv").config();

const express = require("express");
const { DatabaseSync } = require("node:sqlite");

const app = express();
const PORT = 3000;

const ROOT =
    "https://personal.connectapi.garmin.com";

const dataDir = path.join(__dirname, "data");

fs.mkdirSync(dataDir, {
    recursive: true
});

app.use(express.json({
    limit: "20kb"
}));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

const db = new DatabaseSync(
    path.join(dataDir, "garmin.sqlite")
);

// API-AVAINTEN SALAUS

const keyFile = path.join(
    dataDir,
    "encryption.key"
);

if (!fs.existsSync(keyFile)) {
    fs.writeFileSync(
        keyFile,
        crypto.randomBytes(32),
        {
            flag: "wx",
            mode: 0o600
        }
    );
}

const secret = fs.readFileSync(keyFile);

if (secret.length !== 32) {
    throw new Error(
        "Salausavain on virheellinen"
    );
}

function encrypt(value) {
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        secret,
        iv
    );

    const encrypted = Buffer.concat([
        cipher.update(value, "utf8"),
        cipher.final()
    ]);

    return [
        iv.toString("hex"),
        cipher.getAuthTag().toString("hex"),
        encrypted.toString("hex")
    ].join(":");
}

function decrypt(value) {
    const [iv, tag, content] =
        value.split(":");

    const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        secret,
        Buffer.from(iv, "hex")
    );

    decipher.setAuthTag(
        Buffer.from(tag, "hex")
    );

    return Buffer.concat([
        decipher.update(
            Buffer.from(content, "hex")
        ),
        decipher.final()
    ]).toString("utf8");
}

// TIETOKANTA

db.exec(`
CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_steps (
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    steps INTEGER NOT NULL,
    PRIMARY KEY (client_id, date)
);

CREATE TABLE IF NOT EXISTS client_metrics (
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    heart_rate REAL,
    calories REAL,
    PRIMARY KEY (client_id, date)
);

CREATE TABLE IF NOT EXISTS client_workouts (
    client_id INTEGER NOT NULL,
    activity_id TEXT NOT NULL,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    duration REAL,
    distance REAL,
    PRIMARY KEY (client_id, activity_id)
);

CREATE TABLE IF NOT EXISTS client_weights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    weight REAL NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(client_id, date)
);
`);

const getClient = db.prepare(
    "SELECT * FROM clients WHERE id = ?"
);

const saveSteps = db.prepare(`
INSERT INTO client_steps (
    client_id, date, steps
)
VALUES (?, ?, ?)
ON CONFLICT(client_id, date)
DO UPDATE SET
    steps = excluded.steps
`);

const saveMetrics = db.prepare(`
INSERT INTO client_metrics (
    client_id,
    date,
    heart_rate,
    calories
)
VALUES (?, ?, ?, ?)
ON CONFLICT(client_id, date)
DO UPDATE SET
    heart_rate = COALESCE(
        excluded.heart_rate,
        client_metrics.heart_rate
    ),
    calories = COALESCE(
        excluded.calories,
        client_metrics.calories
    )
`);

const saveWorkout = db.prepare(`
INSERT INTO client_workouts (
    client_id,
    activity_id,
    date,
    name,
    duration,
    distance
)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT(client_id, activity_id)
DO UPDATE SET
    date = excluded.date,
    name = excluded.name,
    duration = excluded.duration,
    distance = excluded.distance
`);

const saveWeight = db.prepare(`
INSERT INTO client_weights (
    client_id,
    date,
    weight,
    created_at
)
VALUES (?, ?, ?, ?)
ON CONFLICT(client_id, date)
DO UPDATE SET
    weight = excluded.weight,
    created_at = excluded.created_at
`);

// APUFUNKTIOT

function today() {
    const d = new Date();

    return [
        d.getFullYear(),
        String(
            d.getMonth() + 1
        ).padStart(2, "0"),
        String(
            d.getDate()
        ).padStart(2, "0")
    ].join("-");
}

function shift(date, days) {
    const [y, m, d] =
        date.split("-").map(Number);

    return new Date(
        Date.UTC(y, m - 1, d + days)
    ).toISOString().slice(0, 10);
}

function validDate(date) {
    if (
        typeof date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return false;
    }

    try {
        return shift(date, 0) === date;
    } catch {
        return false;
    }
}

function numeric(value) {
    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }

    const number = Number(value);

    return (
        Number.isFinite(number) &&
        number >= 0
    )
        ? number
        : null;
}

function first(obj, keys) {
    for (const key of keys) {
        const value = numeric(
            obj?.[key]
        );

        if (value !== null) {
            return value;
        }
    }

    return null;
}

function wait(ms) {
    return new Promise(
        resolve => setTimeout(resolve, ms)
    );
}

function clientFromRequest(req, res) {
    const id = Number(req.params.id);

    if (
        !Number.isSafeInteger(id) ||
        id < 1
    ) {
        res.status(400).json({
            error: "Virheellinen asiakastunnus"
        });

        return null;
    }

    const client = getClient.get(id);

    if (!client) {
        res.status(404).json({
            error: "Asiakasta ei löydy"
        });

        return null;
    }

    return client;
}

// GARMIN-YHTEYS

const tokens = new Map();

async function requestToken(apiKey) {
    const response = await fetch(
        ROOT +
        "/personalapitoken-service/personal-api/personal-api-key/token",
        {
            method: "POST",
            headers: {
                Authorization: `ApiKey ${apiKey}`
            },
            signal:
                AbortSignal.timeout(20000)
        }
    );

    if (!response.ok) {
        throw new Error(
            "Garmin ei hyväksynyt API-avainta " +
            `(HTTP ${response.status})`
        );
    }

    const token = (
        await response.text()
    ).trim();

    if (!token) {
        throw new Error(
            "Garmin palautti tyhjän tokenin"
        );
    }

    return token;
}

async function getToken(
    client,
    force = false
) {
    const cached = tokens.get(
        client.id
    );

    if (
        !force &&
        cached &&
        Date.now() - cached.time <
            60 * 60 * 1000
    ) {
        return cached.token;
    }

    const apiKey = decrypt(
        client.api_key_encrypted
    );

    const token = await requestToken(
        apiKey
    );

    tokens.set(client.id, {
        token,
        time: Date.now()
    });

    return token;
}

async function garmin(
    client,
    endpoint
) {
    for (
        let attempt = 0;
        attempt < 2;
        attempt++
    ) {
        const token = await getToken(
            client,
            attempt === 1
        );

        const response = await fetch(
            ROOT + endpoint,
            {
                headers: {
                    Authorization:
                        `Bearer ${token}`,
                    Accept:
                        "application/json"
                },
                signal:
                    AbortSignal.timeout(25000)
            }
        );

        if (
            response.status === 401 &&
            attempt === 0
        ) {
            tokens.delete(client.id);
            continue;
        }

        if (!response.ok) {
            throw new Error(
                `Garmin API: HTTP ${response.status}`
            );
        }

        return response.json();
    }

    throw new Error(
        "Garmin-kirjautuminen epäonnistui"
    );
}

// ASIAKASHALLINTA

app.get(
    "/api/clients",
    (req, res) => {
        const clients = db.prepare(`
            SELECT
                id,
                name,
                created_at
            FROM clients
            ORDER BY name COLLATE NOCASE
        `).all();

        res.json({ clients });
    }
);

app.post(
    "/api/clients",
    async (req, res) => {
        const name = String(
            req.body?.name || ""
        ).trim();

        const apiKey = String(
            req.body?.apiKey || ""
        ).trim();

        if (
            name.length < 2 ||
            name.length > 100 ||
            apiKey.length < 10 ||
            apiKey.length > 4096
        ) {
            return res.status(400).json({
                error:
                    "Tarkista nimi ja Garmin API -avain"
            });
        }

        try {
            await requestToken(apiKey);

            const result = db.prepare(`
                INSERT INTO clients (
                    name,
                    api_key_encrypted,
                    created_at
                )
                VALUES (?, ?, ?)
            `).run(
                name,
                encrypt(apiKey),
                new Date().toISOString()
            );

            res.status(201).json({
                id: Number(
                    result.lastInsertRowid
                ),
                name
            });

        } catch (error) {
            res.status(400).json({
                error: error.message
            });
        }
    }
);

// SYNKRONOINTIEN TILAT

const jobs = new Map();

app.delete(
    "/api/clients/:id",
    (req, res) => {
        const client =
            clientFromRequest(req, res);

        if (!client) return;

        if (
            jobs.get(client.id)?.running
        ) {
            return res.status(409).json({
                error:
                    "Odota synkronoinnin valmistumista"
            });
        }

        db.exec("BEGIN");

        try {
            for (const table of [
                "client_steps",
                "client_metrics",
                "client_workouts",
                "client_weights"
            ]) {
                db.prepare(
                    `DELETE FROM ${table} WHERE client_id = ?`
                ).run(client.id);
            }

            db.prepare(
                "DELETE FROM clients WHERE id = ?"
            ).run(client.id);

            db.exec("COMMIT");

            tokens.delete(client.id);
            jobs.delete(client.id);

            res.json({
                success: true
            });

        } catch {
            db.exec("ROLLBACK");

            res.status(500).json({
                error:
                    "Asiakkaan poistaminen epäonnistui"
            });
        }
    }
);

// ASKELEET

async function fetchSteps(
    client,
    date
) {
    const raw = await garmin(
        client,
        `/usersummary-service/stats/steps/daily/${date}/${date}`
    );

    const list = Array.isArray(raw)
        ? raw
        : [raw];

    const values = list
        .map(
            item => numeric(
                item?.totalSteps
            )
        )
        .filter(
            value => value !== null
        );

    if (values.length) {
        saveSteps.run(
            client.id,
            date,
            values.reduce(
                (sum, value) =>
                    sum + value,
                0
            )
        );
    }
}

// SYKE JA KALORIT

async function fetchMetrics(
    client,
    date
) {
    const results =
        await Promise.allSettled([
            garmin(
                client,
                `/wellness-service/wellness/dailyHeartRate?date=${date}`
            ),
            garmin(
                client,
                `/usersummary-service/usersummary/daily?calendarDate=${date}`
            )
        ]);

    const heart =
        results[0].status === "fulfilled"
            ? results[0].value
            : null;

    const summary =
        results[1].status === "fulfilled"
            ? results[1].value
            : null;

    const heartRate =
        first(heart, [
            "restingHeartRate",
            "restingHeartRateValue"
        ]) ??
        first(summary, [
            "restingHeartRate"
        ]);

    const calories =
        first(summary, [
            "totalKilocalories",
            "totalCalories"
        ]) ??
        (
            numeric(
                summary?.activeKilocalories
            ) !== null &&
            numeric(
                summary?.bmrKilocalories
            ) !== null
                ? Number(
                    summary.activeKilocalories
                ) + Number(
                    summary.bmrKilocalories
                )
                : null
        );

    if (
        heartRate !== null ||
        calories !== null
    ) {
        saveMetrics.run(
            client.id,
            date,
            heartRate,
            calories
        );
    }

    if (
        results.every(
            item =>
                item.status === "rejected"
        )
    ) {
        throw new Error(
            "Sykkeen ja kalorien haku epäonnistui"
        );
    }
}

// HARJOITUSHISTORIA

async function fetchWorkouts(
    client,
    start,
    end
) {
    let saved = 0;

    for (
        let offset = 0;
        offset < 500;
        offset += 100
    ) {
        const query =
            new URLSearchParams({
                start: String(offset),
                limit: "100",
                startDate: start,
                endDate: end
            });

        const raw = await garmin(
            client,
            "/activitylist-service/activities/search/activities?" +
            query
        );

        const list = Array.isArray(raw)
            ? raw
            : Array.isArray(
                raw?.activities
            )
                ? raw.activities
                : [];

        for (const activity of list) {
            if (
                activity.activityId == null
            ) {
                continue;
            }

            const date = String(
                activity.startTimeLocal ||
                activity.startTimeGMT ||
                ""
            ).slice(0, 10);

            if (!validDate(date)) {
                continue;
            }

            saveWorkout.run(
                client.id,
                String(
                    activity.activityId
                ),
                date,
                String(
                    activity.activityName ||
                    activity.activityType?.typeKey ||
                    "Harjoitus"
                ),
                numeric(
                    activity.duration
                ),
                numeric(
                    activity.distance
                )
            );

            saved++;
        }

        if (list.length < 100) {
            break;
        }

        await wait(300);
    }

    return saved;
}

// PAINOHISTORIA

function extractWeight(day) {
    const measurements =
        Array.isArray(
            day?.allWeightMetrics
        )
            ? [...day.allWeightMetrics]
            : [];

    measurements.sort(
        (a, b) =>
            Number(
                a?.date ??
                a?.timestampGMT ??
                0
            ) -
            Number(
                b?.date ??
                b?.timestampGMT ??
                0
            )
    );

    const measurement =
        measurements.length
            ? measurements[
                measurements.length - 1
            ]
            : day?.latestWeight ?? day;

    const grams =
        numeric(
            measurement?.weight
        ) ??
        numeric(
            measurement?.weightInGrams
        ) ??
        numeric(
            day?.weight
        );

    if (grams === null) {
        return null;
    }

    const kilograms =
        grams / 1000;

    if (
        kilograms < 20 ||
        kilograms > 400
    ) {
        return null;
    }

    return kilograms;
}

async function fetchWeights(
    client,
    start,
    end
) {
    const result = await garmin(
        client,
        `/weight-service/weight/range/${start}/${end}?includeAll=true`
    );

    const days =
        Array.isArray(
            result?.dailyWeightSummaries
        )
            ? result.dailyWeightSummaries
            : Array.isArray(result)
                ? result
                : [];

    let saved = 0;

    for (const day of days) {
        const date =
            day?.calendarDate ||
            day?.summaryDate ||
            day?.date;

        if (!validDate(date)) {
            continue;
        }

        const kilograms =
            extractWeight(day);

        if (kilograms === null) {
            continue;
        }

        saveWeight.run(
            client.id,
            date,
            kilograms,
            new Date().toISOString()
        );

        saved++;
    }

    return saved;
}

// PÄIVÄN TIEDOT

app.get(
    "/api/clients/:id/today",
    (req, res) => {
        const client =
            clientFromRequest(req, res);

        if (!client) return;

        const date = today();

        const steps = db.prepare(`
            SELECT steps
            FROM client_steps
            WHERE
                client_id = ?
                AND date = ?
        `).get(
            client.id,
            date
        );

        const metrics = db.prepare(`
            SELECT
                heart_rate,
                calories
            FROM client_metrics
            WHERE
                client_id = ?
                AND date = ?
        `).get(
            client.id,
            date
        );

        const workout = db.prepare(`
            SELECT *
            FROM client_workouts
            WHERE client_id = ?
            ORDER BY
                date DESC,
                activity_id DESC
            LIMIT 1
        `).get(client.id);

        res.json({
            date,
            steps:
                steps?.steps ?? null,
            metrics:
                metrics || null,
            workout:
                workout || null
        });
    }
);

// HISTORIATIEDOT

app.get(
    "/api/clients/:id/history",
    (req, res) => {
        const client =
            clientFromRequest(req, res);

        if (!client) return;

        const type =
            req.query.type || "steps";

        const days = Number(
            req.query.days || 7
        );

        if (
            ![
                "steps",
                "heart-rate",
                "calories"
            ].includes(type) ||
            ![
                7,
                30,
                90,
                365
            ].includes(days)
        ) {
            return res.status(400).json({
                error:
                    "Virheellinen mittari tai ajanjakso"
            });
        }

        const end = today();

        const start = shift(
            end,
            1 - days
        );

        const queries = {
            steps: `
                SELECT
                    date,
                    steps AS value
                FROM client_steps
                WHERE
                    client_id = ?
                    AND date BETWEEN ? AND ?
            `,

            "heart-rate": `
                SELECT
                    date,
                    heart_rate AS value
                FROM client_metrics
                WHERE
                    client_id = ?
                    AND date BETWEEN ? AND ?
            `,

            calories: `
                SELECT
                    date,
                    calories AS value
                FROM client_metrics
                WHERE
                    client_id = ?
                    AND date BETWEEN ? AND ?
            `
        };

        const rows = db.prepare(
            queries[type]
        ).all(
            client.id,
            start,
            end
        );

        const values = new Map(
            rows.map(
                row => [
                    row.date,
                    row.value
                ]
            )
        );

        const data = Array.from(
            {
                length: days
            },
            (_, index) => {
                const date = shift(
                    start,
                    index
                );

                return {
                    date,
                    value:
                        values.get(date) ?? null
                };
            }
        );

        res.json({
            type,
            data
        });
    }
);

// HARJOITUSTEN LISTAUS

app.get(
    "/api/clients/:id/workouts",
    (req, res) => {
        const client =
            clientFromRequest(req, res);

        if (!client) return;

        const days = Number(
            req.query.days || 30
        );

        if (
            ![
                7,
                30,
                90,
                365
            ].includes(days)
        ) {
            return res.status(400).json({
                error:
                    "Virheellinen ajanjakso"
            });
        }

        const data = db.prepare(`
            SELECT *
            FROM client_workouts
            WHERE
                client_id = ?
                AND date >= ?
            ORDER BY
                date DESC,
                activity_id DESC
            LIMIT 200
        `).all(
            client.id,
            shift(
                today(),
                1 - days
            )
        );

        res.json({ data });
    }
);

// PAINOMITTAUSTEN LISTAUS

app.get(
    "/api/clients/:id/weights",
    (req, res) => {
        const client =
            clientFromRequest(req, res);

        if (!client) return;

        const data = db.prepare(`
            SELECT
                id,
                date,
                weight
            FROM client_weights
            WHERE client_id = ?
            ORDER BY date ASC
        `).all(client.id);

        res.json({ data });
    }
);

// SYNKRONOINTI

function newJob(days) {
    return {
        running: true,
        days,
        pendingDays: 0,
        done: 0,
        total: days,
        failed: 0,
        weightsFound: null,
        workoutsFound: null,
        message:
            "Aloitetaan Garmin-hakua...",
        errors: [],
        finishedAt: null
    };
}

function recordError(
    job,
    label,
    error
) {
    job.failed++;

    const message =
        `${label}: ${error.message}`;

    job.errors.push(message);

    console.warn(message);
}

async function runSync(
    client,
    job,
    days
) {
    const end = today();

    const start = shift(
        end,
        1 - days
    );

    job.days = days;
    job.done = 0;
    job.total = days;
    job.failed = 0;
    job.errors = [];
    job.weightsFound = null;
    job.workoutsFound = null;

    // Painot ja harjoitukset ensin.

    job.message =
        "Haetaan painoja ja harjoituksia...";

    const firstResults =
        await Promise.allSettled([
            fetchWeights(
                client,
                start,
                end
            ),
            fetchWorkouts(
                client,
                start,
                end
            )
        ]);

    if (
        firstResults[0].status ===
        "fulfilled"
    ) {
        job.weightsFound =
            firstResults[0].value;
    } else {
        recordError(
            job,
            "Painon haku",
            firstResults[0].reason
        );
    }

    if (
        firstResults[1].status ===
        "fulfilled"
    ) {
        job.workoutsFound =
            firstResults[1].value;
    } else {
        recordError(
            job,
            "Harjoitusten haku",
            firstResults[1].reason
        );
    }

    // Askeleet, syke ja kalorit.

    for (
        let i = 0;
        i < days;
        i++
    ) {
        const date = shift(
            start,
            i
        );

        job.message =
            "Haetaan askeleita, sykettä " +
            "ja kaloreita " +
            `(${i + 1}/${days})`;

        const results =
            await Promise.allSettled([
                fetchSteps(
                    client,
                    date
                ),
                fetchMetrics(
                    client,
                    date
                )
            ]);

        if (
            results[0].status ===
            "rejected"
        ) {
            recordError(
                job,
                `Askeleet ${date}`,
                results[0].reason
            );
        }

        if (
            results[1].status ===
            "rejected"
        ) {
            recordError(
                job,
                `Syke/kalorit ${date}`,
                results[1].reason
            );
        }

        job.done = i + 1;

        if (i < days - 1) {
            await wait(450);
        }
    }

    job.message = job.failed
        ? `Haku valmistui, virheitä: ${job.failed}`
        : "Kaikki Garmin-tiedot haettu";

    console.log(
        `Asiakas ${client.id}: ` +
        `päiviä ${days}, ` +
        `painoja ${job.weightsFound ?? "virhe"}, ` +
        `harjoituksia ${job.workoutsFound ?? "virhe"}, ` +
        `virheitä ${job.failed}`
    );
}

function startSync(
    client,
    days
) {
    const existing = jobs.get(
        client.id
    );

    if (existing?.running) {
        if (
            days > existing.days
        ) {
            existing.pendingDays =
                Math.max(
                    existing.pendingDays,
                    days
                );

            existing.message =
                "Nykyinen haku käynnissä. " +
                `${existing.pendingDays} päivän ` +
                "haku jonossa.";
        }

        return {
            started: false,
            queued:
                existing.pendingDays > 0
        };
    }

    const job = newJob(days);

    jobs.set(
        client.id,
        job
    );

    (async () => {
        let nextDays = days;

        while (nextDays > 0) {
            await runSync(
                client,
                job,
                nextDays
            );

            nextDays =
                job.pendingDays;

            job.pendingDays = 0;

            if (nextDays > 0) {
                job.message =
                    "Aloitetaan jonossa ollut " +
                    `${nextDays} päivän haku...`;
            }
        }

    })()
        .catch(error => {
            recordError(
                job,
                "Synkronointi",
                error
            );

            job.message =
                "Synkronointi keskeytyi: " +
                error.message;
        })
        .finally(() => {
            job.running = false;
            job.finishedAt =
                new Date().toISOString();
        });

    return {
        started: true,
        queued: false
    };
}

// KÄYNNISTÄ HAKU

app.post(
    "/api/clients/:id/sync",
    (req, res) => {
        const client =
            clientFromRequest(req, res);

        if (!client) return;

        const days = Number(
            req.body?.days || 7
        );

        if (
            ![
                7,
                30,
                90,
                365
            ].includes(days)
        ) {
            return res.status(400).json({
                error:
                    "Virheellinen ajanjakso"
            });
        }

        const result = startSync(
            client,
            days
        );

        res.status(202).json({
            message: result.started
                ? "Garmin-haku käynnistetty"
                : result.queued
                    ? "Pidempi Garmin-haku lisätty jonoon"
                    : "Garmin-haku on jo käynnissä",
            ...result
        });
    }
);

// HAUN TILA

app.get(
    "/api/clients/:id/sync-status",
    (req, res) => {
        const client =
            clientFromRequest(req, res);

        if (!client) return;

        res.json(
            jobs.get(client.id) || {
                running: false,
                days: 0,
                pendingDays: 0,
                done: 0,
                total: 0,
                failed: 0,
                weightsFound: null,
                workoutsFound: null,
                message:
                    "Hakua ei ole vielä aloitettu",
                errors: [],
                finishedAt: null
            }
        );
    }
);

// AUTOMAATTINEN GARMIN-HAKU

function autoSync() {
    const clients = db.prepare(
        "SELECT * FROM clients ORDER BY id"
    ).all();

    for (const client of clients) {
        if (
            !jobs.get(client.id)?.running
        ) {
            startSync(
                client,
                7
            );
        }
    }
}

// PALVELIMEN KÄYNNISTYS

app.listen(
    PORT,
    "127.0.0.1",
    () => {
        console.log("");
        console.log(
            "Garmin Dashboard käynnissä!"
        );
        console.log(
            `Avaa: http://127.0.0.1:${PORT}`
        );
        console.log("");

        autoSync();

        setInterval(
            autoSync,
            15 * 60 * 1000
        );
    }
);
