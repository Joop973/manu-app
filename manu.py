import streamlit as st
import pandas as pd
import time

# --- STRENG KONTROLLIERTES DESIGN ---
st.set_page_config(page_title="Manu Finanzen", layout="centered", page_icon="💎")

st.markdown("""
    <style>
    /* Hintergrund: Hellgrau für Tiefe */
    .stApp { background-color: #F4F7F6; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }

    /* Überschriften: Schwarz & Fett */
    h1, h2, h3 { color: #1A1A1A !important; font-weight: 800 !important; }

    /* Button Styling: SCHWARZER HINTERGRUND, WEISSE SCHRIFT */
    /* Dies behebt das Problem der Unleserlichkeit */
    div.stButton > button {
        background-color: #1A1A1A !important;
        color: #FFFFFF !important;
        border-radius: 15px !important;
        border: none !important;
        height: 3.5rem !important;
        width: 100% !important;
        font-size: 18px !important;
        font-weight: 600 !important;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
    }

    /* Hover-Effekt für Buttons */
    div.stButton > button:hover {
        background-color: #333333 !important;
        border: 1px solid #D4AF37 !important;
    }

    /* Finanz-Karten (Cards) */
    .finance-card {
        background-color: #FFFFFF;
        border-radius: 20px;
        padding: 20px;
        margin-bottom: 12px;
        border: 1px solid #E0E0E0;
    }

    /* Detail-Overlay Box */
    .detail-overlay {
        background-color: #FFFFFF !important;
        border: 3px solid #D4AF37 !important;
        border-radius: 25px !important;
        padding: 25px !important;
        color: #1A1A1A !important;
        margin-top: 20px !important;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15) !important;
    }

    /* Schriftfarbe für alle Standard-Texte */
    .stText, p, span { color: #1A1A1A !important; font-size: 18px; }
    </style>
    """, unsafe_allow_html=True)

# --- APP LOGIK ---
if "page" not in st.session_state: st.session_state.page = "home"
if "data" not in st.session_state: st.session_state.data = None

def nav(target, data=None):
    st.session_state.page = target
    st.session_state.data = data
    st.rerun()

# --- STARTSEITE ---
if st.session_state.page == "home":
    st.markdown("<h1 style='text-align: center;'>💎 MANU</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center;'>Wähle dein Objekt aus:</p>", unsafe_allow_html=True)
    
    if st.button("🏢 SÜDSTRASSE"): nav("dash", "Südstraße")
    if st.button("🏠 ANNAVEEN / FINKENSTR."): nav("dash", "Annaveen")

# --- DASHBOARD ---
elif st.session_state.page == "dash":
    st.markdown(f"<h2>{st.session_state.data}</h2>", unsafe_allow_html=True)
    
    month = st.select_slider("Monat wählen", options=["Jan", "Feb", "Mär", "Apr", "Mai", "Jun"])
    
    # EINNAHMEN
    st.markdown("### 📈 Einnahmen")
    ein_list = [
        {"name": "Mieter Urfahn", "wert": "750,00 €", "date": "05.05.", "desc": "Miete Mai erhalten"},
        {"name": "Mieter Brand", "wert": "850,00 €", "date": "02.05.", "desc": "Miete inkl. Stellplatz"}
    ]
    for e in ein_list:
        c1, c2 = st.columns([3, 1])
        with c1:
            if st.button(f"👤 {e['name']}", key=e['name']): nav("detail", e)
        with c2:
            st.markdown(f"<p style='color: #27AE60; font-weight: bold; margin-top: 15px;'>{e['wert']}</p>", unsafe_allow_html=True)

    # AUSGABEN
    st.markdown("### 📉 Ausgaben")
    aus_list = [
        {"name": "Handwerker April", "wert": "-553,00 €", "date": "15.04.", "desc": "Reparatur Dachrinne"},
        {"name": "Versicherung", "wert": "-45,00 €", "date": "01.05.", "desc": "Gebäudeversicherung"}
    ]
    for a in aus_list:
        c1, c2 = st.columns([3, 1])
        with c1:
            if st.button(f"🛠️ {a['name']}", key=a['name']): nav("detail", a)
        with c2:
            st.markdown(f"<p style='color: #C0392B; font-weight: bold; margin-top: 15px;'>{a['wert']}</p>", unsafe_allow_html=True)

    st.markdown("---")
    if st.button("📸 BELEG SCANNEN"): nav("cam")
    if st.button("⬅️ ZURÜCK"): nav("home")

# --- DETAIL OVERLAY ---
elif st.session_state.page == "detail":
    d = st.session_state.data
    st.markdown("<div class='detail-overlay'>", unsafe_allow_html=True)
    st.markdown(f"<h3>🔎 {d['name']}</h3>", unsafe_allow_html=True)
    st.markdown(f"<p><b>Betrag:</b> {d['wert']}</p>", unsafe_allow_html=True)
    st.markdown(f"<p><b>Datum:</b> {d['date']}</p>", unsafe_allow_html=True)
    st.markdown(f"<p><b>Notiz:</b> {d['desc']}</p>", unsafe_allow_html=True)
    st.markdown("</div>", unsafe_allow_html=True)
    
    st.image("https://via.placeholder.com/400x300.png?text=BELEG+VORSCHAU", caption="Gespeicherter Beleg")
    
    if st.button("✅ ZURÜCK ZUR ÜBERSICHT"): nav("dash", "Südstraße")

# --- KAMERA ---
elif st.session_state.page == "cam":
    st.markdown("<h3>Beleg erfassen</h3>", unsafe_allow_html=True)
    foto = st.camera_input("Richte die Kamera auf den Beleg")
    if foto:
        st.balloons()
        st.success("Erfolgreich! Beleg wurde verarbeitet.")
        time.sleep(2)
        nav("dash", "Südstraße")