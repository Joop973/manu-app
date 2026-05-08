import streamlit as st
import pandas as pd
import random
from datetime import datetime

# --- KONFIGURATION & CASINO-STYLING ---
st.set_page_config(page_title="Manu - Finanz-Casino", layout="wide", page_icon="🎰")

st.markdown("""
    <style>
    .main { background-color: #0e1117; color: white; }
    .stButton>button { background-color: #f1c40f; color: black; font-weight: bold; border-radius: 10px; border: none; }
    .thick-line { border: 5px solid gold; margin-top: 25px; margin-bottom: 25px; box-shadow: 0px 0px 15px gold; }
    .thermometer-container {
        width: 100%; background-color: #333; border-radius: 20px; padding: 5px; border: 2px solid gold;
    }
    .thermometer-bar {
        height: 35px; border-radius: 15px; 
        background: linear-gradient(90deg, #f1c40f, #27ae60);
        text-align: center; color: black; font-weight: bold; line-height: 35px;
        box-shadow: 0px 0px 10px #2ecc71;
    }
    h1, h2, h3 { color: gold !important; }
    </style>
    """, unsafe_allow_html=True)

# --- FUNKTIONEN: ANIMATIONEN ---
def trigger_jackpot():
    st.balloons()
    münzen = ["💰", "🪙", "✨", "💎", "🎰"]
    regen = " ".join(random.choice(münzen) for _ in range(50))
    st.markdown(f"<h2 style='text-align: center;'>{regen}</h2>", unsafe_allow_html=True)
    st.toast("JACKPOT! Du hast das Monatsziel geknackt!", icon="🎰")

# --- APP LOGIK & DATEN ---
if "kontostand" not in st.session_state:
    st.session_state.kontostand = 32450.0
    st.session_state.ziel_gesamt = 40000.0

# Obere Statuszeile
col_a, col_b, col_c = st.columns(3)
with col_a: st.write(f"📅 {datetime.now().strftime('%d.%m.%Y')}")
with col_b: st.write(f"⏰ {datetime.now().strftime('%H:%M')} Uhr")
with col_c: st.write("👤 User: Manu-Admin")

st.title("🎰 Manu - Das Finanz-Casino")

# Seitenleiste für Navigation
st.sidebar.header("🕹️ Spielhalle")
objekt = st.sidebar.selectbox("Wähle dein Haus:", ["Konto A (Annaveen/Finkenstr.)", "Konto B (Südstraße)"])
monats_ziel = st.sidebar.number_input("Dein Monatsziel (€)", value=2000)

# Dashboard Layout
main_col, side_col = st.columns([3, 1])

with side_col:
    st.markdown("### 🏆 Spar-Thermometer")
    prozent = min(int((st.session_state.kontostand / st.session_state.ziel_gesamt) * 100), 100)
    st.markdown(f"""
        <div class="thermometer-container">
            <div class="thermometer-bar" style="width: {prozent}%;">{st.session_state.kontostand:,.0f}€</div>
        </div>
        <p style='text-align: center; color: gold;'>Ziel: {st.session_state.ziel_gesamt:,.0f}€</p>
    """, unsafe_allow_html=True)
    
    if st.button("📸 Beleg scannen (+XP)"):
        st.success("Kaching! +50 XP")
        st.snow()

with main_col:
    # Beispiel-Daten für die Tabelle
    data = [
        {"Datum": "01.05.", "Name": "Daniel Brand", "Betrag": 850.0, "Kategorie": "Miete", "Typ": "Einnahme"},
        {"Datum": "02.05.", "Name": "Urfahn", "Betrag": 750.0, "Kategorie": "Miete", "Typ": "Einnahme"},
        {"Datum": "05.05.", "Name": "Stadtwerke", "Betrag": -150.0, "Kategorie": "Energie", "Typ": "Umlegbar"},
        {"Datum": "12.05.", "Name": "Dachdecker", "Betrag": -450.0, "Kategorie": "Reparatur", "Typ": "Erhaltung"},
    ]
    df = pd.DataFrame(data)

    st.write("### 💎 Umlegbare Kosten & Miete")
    # Hier kannst du Namen wie Urfahn direkt korrigieren!
    st.data_editor(df[df['Typ'].isin(['Einnahme', 'Umlegbar'])], use_container_width=True)

    st.markdown("<div class='thick-line'></div>", unsafe_allow_html=True)

    st.write("### 🛠️ Erhaltung & Extras")
    st.data_editor(df[df['Typ'].isin(['Erhaltung', 'Extra'])], use_container_width=True)

    # Jackpot Check
    überschuss = df[df['Typ'] == 'Einnahme']['Betrag'].sum() - abs(df[df['Typ'] != 'Einnahme']['Betrag'].sum())
    if st.button("🎰 Monatsabschluss berechnen"):
        if überschuss >= monats_ziel:
            trigger_jackpot()
        else:
            st.info(f"Noch {monats_ziel - überschuss}€ bis zum Jackpot!")

st.sidebar.markdown("---")
if st.sidebar.button("💌 Bericht an Mutter"):
    st.sidebar.success("Bericht versendet! 🚀")