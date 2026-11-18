const el = id => document.getElementById(id);

let selectedClient = null;
let historyChart = null;
let weightChart = null;

let polling = false;
let lastSyncSignature = "";
let lastRefreshAt = 0;

// APUFUNKTIOT

function format(value, unit = "") {
    if (value === null || value === undefined) {
        return "--";
    }

    return Number(value).toLocaleString("fi-FI", {
        maximumFractionDigits: 1
    }) + unit;
}

function weightText(value) {
    return Number(value).toLocaleString("fi-FI", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    });
}

async function api(url, options) {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            data.error || `HTTP ${response.status}`
        );
    }

    return data;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ASIAKKAAT

async function loadClients() {
    const result = await api("/api/clients");
    const container = el("client-list");

    container.replaceChildren();

    if (!result.clients.length) {
        container.textContent =
            "Ei vielä asiakkaita. Lisää ensimmäinen asiakas.";
        return;
    }

    for (const client of result.clients) {
        const row = document.createElement("div");
        row.className = "client-row";

        const name = document.createElement("strong");
        name.textContent = client.name;

        const actions = document.createElement("div");
        actions.className = "controls";

        const select = document.createElement("button");
        select.type = "button";
        select.textContent = "Avaa tiedot";
        select.className = "primary";

        select.addEventListener("click", () => {
            selectClient(client);
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.textContent = "Poista";
        remove.className = "danger";

        remove.addEventListener("click", async () => {
            const confirmed = confirm(
                `Poistetaanko asiakas "${client.name}" ` +
                "ja kaikki hänen tietonsa?"
            );

            if (!confirmed) return;

            try {
                await api(
                    `/api/clients/${client.id}`,
                    { method: "DELETE" }
                );

                if (selectedClient?.id === client.id) {
                    selectedClient = null;
                    el("dashboard").hidden = true;
                    clearDashboard();
                }

                await loadClients();

            } catch (error) {
                alert(error.message);
            }
        });

        actions.append(select, remove);
        row.append(name, actions);
        container.append(row);
    }
}

// ASIAKKAAN LISÄYS

el("client-form").addEventListener(
    "submit",
    async event => {
        event.preventDefault();

        const name = el("client-name").value.trim();
        const apiKey = el("client-key").value.trim();
        const button = el("add-client");

        button.disabled = true;

        el("client-message").textContent =
            "Tarkistetaan Garmin-yhteyttä...";

        try {
            const client = await api("/api/clients", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    apiKey
                })
            });

            el("client-form").reset();

            el("client-message").textContent =
                `Asiakas ${client.name} lisätty!`;

            await loadClients();
            await selectClient(client);

        } catch (error) {
            el("client-message").textContent =
                error.message;

        } finally {
            button.disabled = false;
        }
    }
);

// DASHBOARD

function clearDashboard() {
    el("steps").textContent = "--";
    el("heart-rate").textContent = "--";
    el("calories").textContent = "--";
    el("workout").textContent = "--";

    el("current-weight").textContent = "-- kg";
    el("weight-change").textContent = "-- kg";

    el("workout-list").replaceChildren();
    el("weight-list").replaceChildren();

    el("history-status").textContent = "";
    el("weight-status").textContent = "";
    el("sync-details").textContent = "";
    el("sync-progress").hidden = true;

    if (historyChart) {
        historyChart.destroy();
        historyChart = null;
    }

    if (weightChart) {
        weightChart.destroy();
        weightChart = null;
    }
}

async function selectClient(client) {
    selectedClient = client;

    el("selected-client").textContent = client.name;
    el("dashboard").hidden = false;

    lastSyncSignature = "";
    lastRefreshAt = 0;

    clearDashboard();

    await loadDashboard();

    // Näytetään mahdollinen automaattinen
    // Garmin-haku heti asiakkaan avaamisen jälkeen.
    await checkSyncStatus();

    el("dashboard").scrollIntoView({
        behavior: "smooth"
    });
}

async function loadDashboard() {
    if (!selectedClient) return;

    await Promise.allSettled([
        loadToday(),
        loadHistory(),
        loadWorkouts(),
        loadWeights()
    ]);

    lastRefreshAt = Date.now();
}

// PÄIVÄN TIEDOT

async function loadToday() {
    if (!selectedClient) return;

    const id = selectedClient.id;

    try {
        const data = await api(
            `/api/clients/${id}/today`
        );

        if (selectedClient?.id !== id) return;

        el("steps").textContent =
            format(data.steps);

        el("heart-rate").textContent =
            format(data.metrics?.heart_rate, " bpm");

        el("calories").textContent =
            format(data.metrics?.calories, " kcal");

        if (data.workout) {
            const duration = data.workout.duration;

            el("workout").textContent =
                `${data.workout.name} ` +
                `(${data.workout.date}) – ` +
                format(
                    duration === null
                        ? null
                        : Math.round(duration / 60),
                    " min"
                );
        } else {
            el("workout").textContent =
                "Ei vielä harjoitustietoja.";
        }

    } catch (error) {
        console.error("Päivän tiedot:", error);
    }
}

// GARMIN-HISTORIA

const chartLabels = {
    steps: "Askeleet",
    "heart-rate": "Leposyke (bpm)",
    calories: "Kalorit (kcal)"
};

async function loadHistory() {
    if (!selectedClient) return;

    const id = selectedClient.id;
    const type = el("history-type").value;
    const days = el("history-period").value;

    try {
        const result = await api(
            `/api/clients/${id}/history` +
            `?type=${encodeURIComponent(type)}&days=${days}`
        );

        if (
            selectedClient?.id !== id ||
            el("history-type").value !== type ||
            el("history-period").value !== days
        ) {
            return;
        }

        const data = result.data;

        const count = data.filter(
            item => item.value !== null
        ).length;

        // Synkronoinnin tilateksti näytetään
        // erikseen, jotta se ei häviä
        // kuvaajan päivittyessä.
        el("history-status").textContent =
            `Tallennettuja päiviä: ${count}/${data.length}`;

        if (historyChart) {
            historyChart.destroy();
        }

        historyChart = new Chart(
            el("history-chart"),
            {
                type: "bar",

                data: {
                    labels: data.map(
                        item => item.date.slice(5)
                    ),

                    datasets: [{
                        label: chartLabels[type],
                        data: data.map(
                            item => item.value
                        ),
                        backgroundColor: "#38bdf8"
                    }]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            }
        );

    } catch (error) {
        if (selectedClient?.id === id) {
            el("history-status").textContent =
                error.message;
        }
    }
}

// HARJOITUKSET

async function loadWorkouts() {
    if (!selectedClient) return;

    const id = selectedClient.id;
    const days = el("history-period").value;

    try {
        const result = await api(
            `/api/clients/${id}/workouts?days=${days}`
        );

        if (
            selectedClient?.id !== id ||
            el("history-period").value !== days
        ) {
            return;
        }

        const list = el("workout-list");
        list.replaceChildren();

        if (!result.data.length) {
            list.textContent =
                "Ei vielä tallennettuja harjoituksia.";
            return;
        }

        for (const workout of result.data.slice(0, 30)) {
            const li = document.createElement("li");

            const minutes = workout.duration === null
                ? null
                : Math.round(workout.duration / 60);

            li.textContent =
                `${workout.date}: ${workout.name} – ` +
                format(minutes, " min");

            list.append(li);
        }

    } catch (error) {
        console.error("Harjoitukset:", error);
    }
}

// PAINONSEURANTA

async function loadWeights() {
    if (!selectedClient) return;

    const id = selectedClient.id;

    try {
        const result = await api(
            `/api/clients/${id}/weights`
        );

        if (selectedClient?.id !== id) return;

        const data = result.data;
        const list = el("weight-list");

        list.replaceChildren();

        if (weightChart) {
            weightChart.destroy();
            weightChart = null;
        }

        if (!data.length) {
            el("current-weight").textContent = "-- kg";
            el("weight-change").textContent = "-- kg";

            el("weight-status").textContent =
                "Ei vielä tallennettuja painomittauksia.";

            list.textContent =
                "Odotetaan Garminin painotietoja.";

            return;
        }

        const firstWeight = data[0].weight;
        const lastWeight = data[data.length - 1].weight;
        const change = lastWeight - firstWeight;

        el("current-weight").textContent =
            weightText(lastWeight) + " kg";

        el("weight-change").textContent =
            (change > 0 ? "+" : "") +
            weightText(change) + " kg";

        el("weight-status").textContent =
            `Viimeisin mittaus: ` +
            data[data.length - 1].date +
            ` | Mittauspäiviä: ${data.length}`;

        weightChart = new Chart(
            el("weight-chart"),
            {
                type: "line",

                data: {
                    labels: data.map(
                        item => item.date
                    ),

                    datasets: [{
                        label: "Paino (kg)",
                        data: data.map(
                            item => item.weight
                        ),
                        borderColor: "#38bdf8",
                        backgroundColor: "#38bdf833",
                        tension: 0.25,
                        fill: false,
                        pointRadius: 4
                    }]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    scales: {
                        y: {
                            title: {
                                display: true,
                                text: "Paino (kg)"
                            }
                        }
                    }
                }
            }
        );

        for (const item of [...data].reverse()) {
            const li = document.createElement("li");

            li.textContent =
                `${item.date}: ${weightText(item.weight)} kg`;

            list.append(li);
        }

    } catch (error) {
        console.error("Painot:", error);

        if (selectedClient?.id === id) {
            el("weight-status").textContent =
                error.message;
        }
    }
}

// SYNKRONOINTITILAN NÄYTTÄMINEN

function showSyncStatus(status) {
    const progress = el("sync-progress");
    const details = el("sync-details");

    if (!status.running && !status.total) {
        progress.hidden = true;
        details.textContent =
            "Garmin-hakua ei ole vielä käynnistetty.";
        return;
    }

    if (status.running) {
        progress.hidden = false;

        progress.value = status.total
            ? Math.round(
                status.done / status.total * 100
            )
            : 0;

        details.textContent = status.message;

        if (status.pendingDays > 0) {
            details.textContent +=
                ` | Jonossa: ${status.pendingDays} päivää`;
        }

    } else {
        progress.hidden = true;

        details.textContent =
            status.message +
            (status.finishedAt
                ? " | Päivitetty: " +
                  new Date(
                      status.finishedAt
                  ).toLocaleTimeString("fi-FI")
                : "");

        if (status.failed > 0) {
            details.textContent +=
                ` | Virheitä: ${status.failed}`;

            if (status.errors?.length) {
                details.textContent +=
                    ` | ${status.errors[0]}`;
            }
        }
    }
}

// HAUN TILAN SEURANTA
//
// Päivitetään tiedot myös kesken haun,
// jotta painot ja harjoitukset näkyvät heti,
// kun Garmin palauttaa ne.

async function checkSyncStatus() {
    if (!selectedClient || polling) return;

    polling = true;

    const id = selectedClient.id;

    try {
        const status = await api(
            `/api/clients/${id}/sync-status`
        );

        if (selectedClient?.id !== id) return;

        showSyncStatus(status);

        const signature = [
            status.running,
            status.days,
            status.done,
            status.total,
            status.weightsFound,
            status.workoutsFound,
            status.finishedAt
        ].join("|");

        const changed =
            signature !== lastSyncSignature;

        const finishedNow =
            changed && !status.running &&
            Boolean(status.finishedAt);

        const refreshDuringSync =
            status.running &&
            changed &&
            Date.now() - lastRefreshAt > 4000;

        if (finishedNow || refreshDuringSync) {
            await loadDashboard();
        }

        lastSyncSignature = signature;

    } catch (error) {
        if (selectedClient?.id === id) {
            el("sync-details").textContent =
                "Synkronoinnin tilaa ei saatu: " +
                error.message;
        }

    } finally {
        polling = false;
    }
}

// KÄYNNISTÄ GARMIN-HAKU

async function syncHistory() {
    if (!selectedClient) return;

    const id = selectedClient.id;
    const days = Number(el("history-period").value);
    const button = el("sync-history");

    button.disabled = true;

    try {
        const result = await api(
            `/api/clients/${id}/sync`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ days })
            }
        );

        if (selectedClient?.id === id) {
            el("sync-details").textContent =
                result.message;

            await checkSyncStatus();
        }

    } catch (error) {
        if (selectedClient?.id === id) {
            el("sync-details").textContent =
                error.message;
        }

    } finally {
        button.disabled = false;
    }
}

// TAPAHTUMAT

el("history-type").addEventListener(
    "change",
    loadHistory
);

el("history-period").addEventListener(
    "change",
    () => {
        loadHistory();
        loadWorkouts();
    }
);

el("sync-history").addEventListener(
    "click",
    syncHistory
);

// KÄYNNISTYS

loadClients().catch(error => {
    el("client-message").textContent =
        error.message;
});

// Seurataan Garmin-hakua kahden sekunnin välein.
// Sivua ei tarvitse ladata uudelleen.

setInterval(() => {
    if (selectedClient) {
        checkSyncStatus();
    }
}, 2000);

// Päivitetään tiedot säännöllisesti myös
// silloin, kun Garmin-haku ei ole käynnissä.

setInterval(() => {
    if (selectedClient) {
        loadDashboard();
    }
}, 60 * 1000);
