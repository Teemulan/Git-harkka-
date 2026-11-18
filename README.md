# Garmin dashboard valmentajalle.

## Projektin kuvaus

Garmin Sports Dashboard on henkilökohtaiselle valmentajalle suunniteltu paikallinen verkkosovellus, jolla voidaan seurata asiakkaiden Garmin Connect -palveluun tallennettuja liikunta- ja hyvinvointitietoja.

## Projektin määrittely

Lue [projektin määrittely ja hyväksymiskriteerit](docs/01-projektikuvaus.md).

##Asennus ja käynnistys

## Ominaisuudet

Asiakkaiden lisääminen ja poistaminen

Garmin API -avainten salattu tallennus

Askelmäärien, leposykkeen ja kalorien seuranta

Harjoitushistorian tarkastelu

Mittaustietojen graafiset kuvaajat

Historiatietojen tarkastelu 7, 30, 90 ja 365 päivän ajalta

## Vaatimukset:

Node.js 22 tai uudempi ladattuna

Internet-yhteys ensimmäisellä käynnistyskerralla

## Käynnistäminen:

Lataa projekti GitHubista valitsemalla Code → Download ZIP.

Pura ZIP-tiedosto.

Avaa garmin-dashboard-kansio Visual Studio Codessa.

Avaa terminaali ja suorita:

node server.js

Sovellus asentaa tarvittavat npm-kirjastot automaattisesti, jos ne puuttuvat.

Avaa selaimessa:

http://127.0.0.1:3000

Selaimessa:

Lisää asiakas ja hänen garmin personal API key. Tämän jälkeen lataa asiakkaan tiedot "Hae tiedot Garminista" painikkeesta.
