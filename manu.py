import streamlit as st
import pandas as pd
import time

# --- MOBILE-OPTIMIERTES DESIGN ---
st.set_page_config(page_title="Manu Mobile", layout="centered", page_icon="📱")

st.markdown("""
    <style>
    /* Verhindert horizontales Scrollen komplett */
    .stApp { overflow-x: hidden; background-color: #FFFFFF; }
    
    /* Edle Karten für das Handy */
    .data-card {
        background: #FFFFFF; border-radius: 15px; padding: 15px;
        margin-bottom: 10px; border-left: 5px solid #D4AF37;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        display: flex; justify-content: space-between; align-items: center;
    }
    .card-title { font-weight: bold; font-size: 16px; color: #333; }
    .card-value { font-family: 'Courier New', monospace; font-weight: bold; }
    
    /* Overlay Styling */
    .overlay {
        background-color: #FDFCF0; border: 1px solid #D4AF37;
        border-radius: 20px; padding: 20px; margin-top: 10px;
    }
    </style>
    """, unsafe_allow_html=True)

# --- NAVIGATION ---
if "page" not in st.session_state:
    st.session_state.page = "home"
if "detail_view" not in st.session_state:
    st.session_state.detail_view = None

# --- SIDEBAR ---
with st.sidebar:
    st.title("💎 Manu")
    if st.button("🏠 Startseite"): 
        st.session_state.page = "home"
        st.session_state.detail_view = None
    selected_month = st.select_slider("Wähle den Monat", options=["Jan", "Feb", "Mär", "Apr", "Mai", "Jun"])

# --- HOME: KONTOAUSWAHL ---
if st.session_state.page == "home":
    st.markdown("<h1 style='text-align: center; color: #D4AF37;'>Konto wählen</h1>", unsafe_allow_html=True)
    if st.button("🏦 Haus A (Annaveen)", use_container_width=True):
        st.session_state.page = "dash"
    if st.button("🏦 Haus B (Südstraße)", use_container_width=True):
        st.session_state.page = "dash"

# --- DASHBOARD: MOBILE ANSICHT ---
elif st.session_state.page == "dash":
    st.markdown(f"<h2 style='text-align: center;'>{selected_month} Übersicht</h2>", unsafe_allow_html=True)
    
    # --- AUSGABEN SEKTION ---
    st.markdown("### ➖ Ausgaben")
    # Beispiel-Daten
    ausgaben = [
        {"name": "Handwerker Schulze", "betrag": -553.00, "datum": "12.04.2026", "info": "Dachrinnenreinigung"},
        {"name": "Stadtwerke", "betrag": -120.50, "datum": "01.04.2026", "info": "Abschlag Strom"}
    ]
    
    for item in ausgaben:
        col_name, col_val = st.columns([2, 1])
        with col_name:
            if st.button(f"📍 {item['name']}", key=item['name']):
                st.session_state.detail_view = item
        with col_val:
            st.markdown(f"<span style='color: #B71C1C; font-weight: bold;'>{item['betrag']} €</span>", unsafe_allow_html=True)

    # --- EINNAHMEN SEKTION ---
    st.markdown("### ➕ Einnahmen")
    einnahmen = [
        {"name": "Mieter Urfahn", "betrag": 750.00, "datum": "03.04.2026", "info": "Kaltmiete + NK"},
        {"name": "Mieter Daniel Brand", "betrag": 850.00, "datum": "02.04.2026", "info": "Kaltmiete"}
    ]
    
    for item in einnahmen:
        col_name, col_val = st.columns([2, 1])
        with col_name:
            if st.button(f"👤 {item['name']}", key=item['name']):
                st.session_state.detail_view = item
        with col_val:
            st.markdown(f"<span style='color: #1B5E20; font-weight: bold;'>{item['betrag']} €</span>", unsafe_allow_html=True)

    # --- DETAIL OVERLAY (WENN GEKLICKT) ---
    if st.session_state.detail_view:
        view = st.session_state.detail_view
        st.markdown("---")
        st.markdown(f"""
            <div class="overlay">
                <h3 style="color: #D4AF37; margin-top: 0;">🔎 Details: {view['name']}</h3>
                <p><b>Betrag:</b> {view['betrag']} €</p>
                <p><b>Datum:</b> {view['datum']}</p>
                <p><b>Notiz:</b> {view['info']}</p>
            </div>
        """, unsafe_allow_html=True)
        # Platzhalter für das Belegfoto
        st.image("https://via.placeholder.com/400x250.png?text=Beleg+Foto+Vorschau", caption="Hinterlegter Beleg")
        if st.button("❌ Schließen"):
            st.session_state.detail_view = None
            st.rerun()

    # --- DER FIXIERTE SCANNER-BUTTON ---
    st.markdown("---")
    if st.button("📸 BELEG JETZT SCANNEN", use_container_width=True):
        st.session_state.show_cam = True
    
    if "show_cam" in st.session_state and st.session_state.show_cam:
        pic = st.camera_input("Foto aufnehmen")
        if pic:
            st.balloons()
            st.audio("https://www.soundjay.com/misc/sounds/cash-register-05.mp3")
            st.success("Beleg erkannt! +1000 Dopamin-Punkte")
            st.session_state.show_cam = False