# [Garmin Dashboard] – projektin määrittely


## Käyttäjä, tarve ja hyöty
Ratkaisun kohderyhmänä ovat personal trainerit, kuntovalmentajat ja muut liikunta-alan ammattilaiset, jotka seuraavat asiakkaidensa harjoittelua ja hyvinvointia

Projektin tarkoituksena on ratkaista ongelma, jossa valmentaja joutuu pyytämään asiakkailtaan kuntotietoja erikseen esimerkiksi viesteillä, kuvakaappauksilla tai suullisesti.
Tämä tekee tietojen keräämisestä ja asiakkaan kehityksen seuraamisesta hidasta ja hankalaa.

Ohjelmiston avulla valmentaja voi tarkastella asiakkaidensa Garmin-älykellojen keräämiä kuntotietoja yhdestä selainpohjaisesta sovelluksesta.
Asiakkaan suostumuksella valmentaja voi seurata esimerkiksi asiakkaan askelmäärää, sykettä, unen laatua, kulutettuja kaloreita ja stressitasoja. 
Näin valmentaja saa paremman kokonaiskuvan asiakkaan aktiivisuudesta, palautumisesta ja harjoittelusta.




## Käyttäjäskenaariot

Valmentaja haluaa tarkastella asiakkaansa päivittäisiä askelmääriä, jotta hän voi seurata asiakkaan yleistä aktiivisuutta ja liikkumista.

Valmentaja haluaa nähdä asiakkaansa syketietoja, jotta hän voi arvioida harjoittelun kuormittavuutta ja kehitystä.

Valmentaja haluaa tarkastella asiakkaansa unitietoja, jotta hän voi arvioida palautumista ja huomioida sen harjoittelun suunnittelussa.

Valmentaja haluaa tarkastella asiakkaansa aktiivisuus- ja kaloritietoja, jotta hän saa paremman kokonaiskuvan asiakkaan päivittäisestä liikunnasta.

Valmentaja haluaa nähdä asiakkaidensa tiedot yhdestä paikasta, jotta hänen ei tarvitse pyytää jokaiselta asiakkaalta tietoja erikseen.

Asiakas haluaa jakaa omat kuntotietonsa valmentajalleen, jotta valmentaja voi hyödyntää niitä harjoittelun suunnittelussa ja seurannassa.

## Vaatimukset ja hyväksymiskriteerit
| Tunniste | Vaatimus | Hyväksymiskriteeri | Prioriteetti |
|---|---|---|---|
|V1 | Valmentaja voi tarkastella asiakkaiden kuntotietoja. | Asiakkaan tiedot näkyvät valmentajalle käyttöliittymässä asiakkaan luvalla. | Korkea|

|V2 | Sovellus näyttää asiakkaan askelmäärät. | Päivittäiset askelmäärät näkyvät oikein. | Korkea|

|V3 | Sovellus näyttää asiakkaan syketiedot. | Saatavilla olevat syketiedot näkyvät käyttöliittymässä. | Korkea|

|V4 | Sovellus näyttää asiakkaan unitiedot. | Unen kesto ja saatavilla olevat univaiheet näkyvät. | Keskitaso|

|V5 | Sovellus näyttää asiakkaan kalorikulutuksen. | Päivittäiset kalorikulutustiedot näkyvät. | Keskitaso|

|V6 | Sovellus näyttää asiakkaan stressitiedot. | Saatavilla olevat stressitiedot näkyvät käyttöliittymässä. | Keskitaso|

|V7 | Valmentaja voi valita tarkasteltavan asiakkaan. | Valmentaja pystyy siirtymään asiakkaan tietoihin käyttöliittymässä. | Korkea|

|V8 | Asiakas voi antaa luvan tietojensa jakamiseen. | Asiakkaan tietoja ei näytetä valmentajalle ilman asianmukaista lupaa. | Korkea|

|V9 | Sovelluksessa on selkeä käyttöliittymä. | Tiedot ovat helposti löydettävissä ja luettavissa. | Korkea|




## Rajaus

Projektissa toteutetaan ensimmäisessä vaiheessa selainpohjainen sovellus, jonka avulla valmentaja voi tarkastella asiakkaan Garmin-älykellon keräämiä kuntotietoja.

Ensimmäiseen versioon sisällytetään seuraavat ominaisuudet:
Asiakkaan Garmin Connect -tietojen hakeminen.
Asiakkaan päivittäisten askelten näyttäminen.
Syketietojen näyttäminen.
Unitietojen näyttäminen.
Kalorikulutuksen näyttäminen.
Stressitietojen näyttäminen, jos niitä on saatavilla.
Asiakaskohtainen tietojen tarkastelu.
Tietojen esittäminen selkeinä kortteina ja kaavioina.

Projektin ulkopuolelle jätetään ensimmäisessä vaiheessa mobiilisovelluksen kehittäminen, muiden älykellovalmistajien tukeminen, harjoitusohjelmien automaattinen luominen, maksulliset palvelut sekä laaja asiakashallintajärjestelmä.

Ensimmäinen toteutus keskittyy Garmin Venu 2 -kelloon ja rajattuun määrään asiakkaita.

Projektissa toteutetaan ensimmäisessä vaiheessa [tärkeimmät ominaisuudet].

Projektin ulkopuolelle jätetään [ominaisuudet, joita ei toteuteta].




## Toteutuksen rakenne, oletukset ja riskit

Ohjelmisto koostuu seuraavista osista:

Käyttöliittymä: HTML-, CSS- ja JavaScript-tekniikoilla toteutettu selainpohjainen käyttöliittymä, jossa valmentaja voi valita asiakkaan ja tarkastella tämän kuntotietoja.
Tiedot esitetään selkeinä tietokortteina ja kaavioina. Kaavioissa voidaan hyödyntää Chart.js-kirjastoa.

Sovelluksen toiminnallisuus: Pythonilla toteutettu taustapalvelu, joka hakee Garmin Connect -tietoja ja välittää ne käyttöliittymälle.

Tietojen tallennus: Aluksi tietoja voidaan käsitellä JSON-muodossa. Asiakastietojen määrän kasvaessa voidaan ottaa käyttöön tietokanta.

Tiedonsiirto: Käyttöliittymän ja taustapalvelun välinen tiedonsiirto toteutetaan HTTP-pyyntöjen avulla.

Asiakastietojen hallinta: Sovelluksessa huomioidaan asiakkaiden tietosuoja ja suostumus tietojen jakamiseen valmentajalle.

Projektissa oletetaan, että asiakkaalla on Garmin Connect -tili ja yhteensopiva Garmin-älykello sekä mahdollisuus antaa valmentajalle lupa tietojensa jakamiseen.

Keskeisiä riskejä ovat Garminin rajapinnan käyttörajoitukset, eri kellomallien tietojen yhteensopivuus, asiakkaiden tietojen turvallinen käsittely sekä henkilötietojen suojaaminen. 
Lisäksi on varmistettava, että käytettävä Garmin-rajapinta mahdollistaa asiakkaan tietojen hakemisen asiakkaan omalla luvalla myös valmentajan sovellukseen.

Asiakkaiden terveydentilaan ja hyvinvointiin liittyviä tietoja käsitellään luottamuksellisesti.
Käyttöoikeudet rajataan niin, että valmentaja näkee vain niiden asiakkaiden tiedot, jotka ovat antaneet siihen asianmukaisen luvan.
