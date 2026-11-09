
require("dotenv").config();
const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.static("public"));

// Haetaan Garminin käyttötoken
async function getGarminToken() {
    const response = await fetch(
        "https://personal.connectapi.garmin.com/personalapitoken-service/personal-api/personal-api-key/token",
        {
            method: "POST",
            headers: {
                Authorization: `ApiKey ${process.env.GARMIN_API_KEY}`
            }
        }
    );

    if (!response.ok) {
        throw new Error("Tokenin hakeminen epäonnistui: " + response.status);
    }

    return (await response.text()).trim();
}

// Haetaan päivän askelmäärä Garminista
app.get("/api/steps", async (req, res) => {
    try {
        const token = await getGarminToken();

        const date = req.query.date ||
            new Date().toLocaleDateString("sv-SE");

        const response = await fetch(
            `https://personal.connectapi.garmin.com/usersummary-service/stats/steps/daily/${date}/${date}`,
            {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            throw new Error("Askelten haku epäonnistui: " + response.status);
        }

        const data = await response.json();

        res.json(data);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`Sivusto käynnissä: http://localhost:${PORT}`);
});
