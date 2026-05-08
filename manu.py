import streamlit as st
import pandas as pd
import time
import random

# Sicherer Import für Plotly
try:
    import plotly.express as px
except ImportError:
    st.error("Bitte trage 'plotly' in deine requirements.txt ein und mache einen Reboot.")


# --- HIGH-END KONFIGURATION ---
st.set_page_config(page_title="Manu Finance OS", layout="centered", page_icon="🏦")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    
    .stApp { background-color: #F8F9FA; font-family: 'Inter', sans-serif; }
    
    /* Neumorphe Buttons (Midnight Blue) */
    div.stButton > button {
        background: linear-gradient(145deg, #1D3557, #162a45) !important;
        color: white !important;
        border-radius: 20px !important;
        height: 3.5rem !important;
        font-weight: 700 !important;
        border: none !important;
        box-shadow: 5px 5px 15px rgba(0,0,0,0.1) !important;
        transition: 0.3s;
    }
    div.stButton > button:active { transform: scale(0.97); }

    /* Finanz-Karten */
    .card { background: white; padding: 20px; border-radius: 25px; border: 1px solid #EEE; margin-bottom: 12px; }
    .plus { color: #27AE60 !important; font-weight: 800; background: #E8F5E9; padding: 4px 8px; border-radius: 8px; }
    .minus { color: #C0392B !important; font-weight: 800; background: #FFEBEE; padding: 4px 8px; border-radius: 8px; }
    
    /* Kontakt-Karte */
    .contact-card { background: #EDF2F4; padding: 15px; border-radius: 20px; border-left: 5px solid #1D3557; }
    </style>
    """, unsafe_allow_html=True)

# --- LOGIK-ZENTRALE ---
if "page" not in st.session_state: st.session_state.page = "home"
if "haus" not in st.session_state: st.session_state.haus = "Alle"

def nav(p, h=None):
    st.session_state.page = p
    if h: st.session_state.haus = h
    st.rerun()

# --- REITER (SIDEBAR) ---
with st.sidebar:
    st.title("💎 Smart Menu")
    if st.button("🏠 Startseite"): nav("home")
    if st.button("📊 Jahres-Checkup"): nav("stats")
    if st.button("📞 Handwerker-Verzeichnis"): nav("contacts")
    st.markdown("---")
    st.write("🔧 **Admin-Bereich**")
    if st.button("📄 Steuer-Export (CSV)"):
        st.toast("Exportiere Daten für Finanzamt...")
        time.sleep(1)
        st.success("Export abgeschlossen!")

# --- SEITE: HOME ---
if st.session_state.page == "home":
    st.markdown("<h1 style='text-align: center;'>Immobilien Zentrale</h1>", unsafe_allow_html=True)
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🏢 Südstraße"): nav("dash", "Südstraße")
        if st.button("🏠 Finkenstraße"): nav("dash", "Finkenstraße")
    with col2:
        if st.button("🌿 Anna-Fehn-Str."): nav("dash", "Anna-Fehn-Straße")
        if st.button("🌍 Gesamte Übersicht"): nav("dash", "Alle")

# --- SEITE: DASHBOARD ---
elif st.session_state.page == "dash":
    st.markdown(f"<h2>Übersicht: {st.session_state.haus}</h2>", unsafe_allow_html=True)
    month = st.select_slider("", options=["Jan", "Feb", "Mär", "Apr", "Mai", "Jun"])
    
    # Beispiel-Daten mit Haus-Zuordnung
    items = [
        {"name": "Mieter Urfahn", "h": "Südstraße", "v": 750.0},
        {"name": "Dachdecker Schulze", "h": "Finkenstraße", "v": -553.0},
        {"name": "Müllabfuhr", "h": "Anna-Fehn-Straße", "v": -45.0}
    ]
    
    for i in items:
        if st.session_state.haus == "Alle" or i["h"] == st.session_state.haus:
            c1, c2 = st.columns([3, 1])
            with c1:
                st.markdown(f"<div class='card'><b>{i['name']}</b><br><small>{i['h']}</small></div>", unsafe_allow_html=True)
            with c2:
                cl = "plus" if i["v"] > 0 else "minus"
                st.markdown(f"<div style='margin-top:20px;' class='{cl}'>{'+' if i['v']>0 else ''}{i['v']} €</div>", unsafe_allow_html=True)

    st.markdown("---")
    if st.button("📸 KI BELEG AUTOPILOT"): nav("cam")

# --- SEITE: KI AUTOPILOT ---
elif st.session_state.page == "cam":
    st.markdown("<h3>📸 KI Beleg Autopilot</h3>")
    st.write("Scanne eine Rechnung. Die KI erkennt Betrag und Kategorie automatisch.")
    foto = st.camera_input("Rechnung fotografieren")
    
    if foto:
        with st.spinner("KI analysiert Daten..."):
            time.sleep(2) # Simulation der KI
            betrag = random.choice([45.50, 120.00, 553.00, 89.90])
            st.balloons()
            st.audio("https://www.soundjay.com/misc/sounds/cash-register-05.mp3")
            st.markdown(f"""
                <div style='background: #D4AF37; padding: 20px; border-radius: 20px; color: white;'>
                    <h4>🎯 Analyse erfolgreich!</h4>
                    <p><b>Erkannter Betrag:</b> {betrag} €</p>
                    <p><b>Kategorie:</b> Instandhaltung</p>
                    <p><b>Datum:</b> {time.strftime('%d.%m.%Y')}</p>
                </div>
            """, unsafe_allow_html=True)
            if st.button("✅ Verbuchen"): nav("dash")

# --- SEITE: HANDWERKER VERZEICHNIS (Feature 5) ---
elif st.session_state.page == "contacts":
    st.markdown("<h2>📞 Handwerker-Direktruf</h2>")
    web_url = st.text_input("Webseite des Handwerkers verlinken (KI-Sync)", placeholder="https://www.handwerker-mueller.de")
    
    if web_url:
        with st.spinner("KI extrahiert Firmendaten..."):
            time.sleep(1.5)
            st.info("KI-Info: Müller & Söhne GmbH | 0172-1234567 | Mo-Fr 08:00-17:00")
            
    st.markdown("<div class='contact-card'><b>Sanitär Meppen</b><br>📞 05931 12345<br>🕒 Geöffnet bis 18:00</div>", unsafe_allow_html=True)
    if st.button("📞 Jetzt anrufen"):
        st.success("Wählvorgang gestartet...")
    if st.button("⬅️ Zurück"): nav("home")

# --- SEITE: STATS (Jahresübersicht) ---
elif st.session_state.page == "stats":
    st.markdown("<h2>Jahresübersicht 2026</h2>")
    df = pd.DataFrame({"Monat": ["Jan", "Feb", "Mär", "Apr"], "Gewinn": [1500, 800, 2100, 1400]})
    fig = px.bar(df, x="Monat", y="Gewinn", color_discrete_sequence=['#1D3557'])
    st.plotly_chart(fig, use_container_width=True)
    if st.button("⬅️ Zurück"): nav("home")