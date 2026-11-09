async function loadGarminData() {
    try {
        const response = await fetch("/api/steps");

        if (!response.ok) {
            throw new Error("Garmin-tietojen hakeminen epäonnistui");
        }

        const data = await response.json();

        console.log("Garmin data:", data);

        const steps = Array.isArray(data)
            ? data.reduce((sum, item) => {
                return sum + (item.totalSteps || 0);
            }, 0)
            : data.totalSteps;

        document.getElementById("steps").textContent =
            steps !== undefined
                ? steps.toLocaleString("fi-FI")
                : "Ei tietoa";

    } catch (error) {
        console.error(error);

        document.getElementById("steps").textContent = "Virhe";
    }
}

loadGarminData();
