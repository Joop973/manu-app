import streamlit as st
import pandas as pd
import time
import random

# --- HIGH-END KONFIGURATION & DESIGN ---
st.set_page_config(page_title="Manu Finance Builder", layout="centered", page_icon="🏗️")

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    .stApp { background-color: #F8F9FA; font-family: 'Inter', sans-serif; }
    
    /* Plus-Button Design (Speziell für neue Objekte) */
    .plus-button {
        border: 2px dashed #1D3557;
        border-radius: 20px;
        color: #1D3557;
        text-align: center;
        padding: 30px;
        cursor: pointer;
        transition: 0.3s;
        font-weight: 800;
        background: rgba(29, 53, 87, 0.05);
    }
    .plus-button:hover { background: rgba(29, 53, 87, 0.1); transform: scale(1.02); }

    /* Standard Button Styling */
    div.stButton > button {
        background: linear-gradient(145deg, #1D3557, #162a45) !important;
        color: white !important;
        border-radius: 18px !important;
        height: 3.5rem !important;
        font-weight: 700 !important;
        box-shadow: 4px 4px 10px rgba(0,0,0,0.1) !important;
        border: none !important;
    }

    /* Finanz-Karten */
    .house-card { background: white; padding: 25px; border-radius: 20px; border: 1px solid #EEE; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .amount-plus { color: #27AE60; font-weight: 900; }
    .amount-minus { color: #C0392B; font-weight: 900; }
    </style>
    """, unsafe_allow_html=True)

# --- SESSION STATE INITIALISIERUNG ---
if "haeuser" not in st.session_state:
    st.session_state.haeuser = []  # Startet komplett leer
if "page" not in st.session_state:
    st.session_state.page = "home"
if "current_haus" not in st.session_state:
    st.session_state.current_haus = None

def nav(p, h=None):
    st.session_state.page = p
    if h: st.session_state.current_haus = h
    st.rerun()

# --- REITER (SIDEBAR) ---
with st.sidebar:
    st.title("💎 Manu OS")
    if st.button("🏠 Home (Alle Häuser)"): nav("home")
    st.markdown("---")
    st.write("📂 **Deine Objekte**")
    for haus in st.session_state.haeuser:
        if st.button(f"📍 {haus}", key=f"side_{haus}"): nav("dash", haus)

# --- SEITE: HOME (DER BUILDER) ---
if st.session_state.page == "home":
    st.markdown("<h1 style='text-align: center;'>Meine Immobilien</h1>", unsafe_allow_html=True)
    
    # Zeige alle existierenden Häuser
    for haus in st.session_state.haeuser:
        if st.button(f"🏠 {haus}", use_container_width=True):
            nav("dash", haus)
    
    # DER PLUS-BUTTON ZUM HINZUFÜGEN
    st.markdown("<br>", unsafe_allow_html=True)
    with st.expander("➕ Neues Objekt hinzufügen", expanded=len(st.session_state.haeuser) == 0):
        neues_haus = st.text_input("Name der Wohnanlage (z.B. Südstraße)", key="new_h")
        if st.button("Objekt erstellen"):
            if neues_haus and neues_haus not in st.session_state.haeuser:
                st.session_state.haeuser.append(neues_haus)
                st.success(f"{neues_haus} wurde hinzugefügt!")
                time.sleep(1)
                st.rerun()

# --- SEITE: DASHBOARD (DIE ÜBERSICHT) ---
elif st.session_state.page == "dash":
    st.markdown(f"<h2>{st.session_state.current_haus}</h2>", unsafe_allow_html=True)
    
    month = st.select_slider("", options=["Jan", "Feb", "Mär", "Apr", "Mai", "Jun"])
    
    # Quick Stats
    c1, c2 = st.columns(2)
    c1.metric("Einnahmen", "2.400 €", "+ 5%")
    c2.metric("Ausgaben", "640 €", "- 12%")

    st.markdown("---")
    
    # BUTTONS FÜR KI-UPLOAD
    st.write("### 📄 Beleg einreichen")
    col_cam, col_file = st.columns(2)
    
    with col_cam:
        if st.button("📸 Foto machen"): nav("cam")
    with col_file:
        if st.button("📁 Datei hochladen"): nav("upload")

    st.markdown("---")
    st.write("🔍 **Letzte Posten**")
    st.info(f"Keine Einträge für {month} vorhanden. Nutze den KI-Upload oben!")

# --- SEITE: KI-UPLOAD (PDF/WORD/PHOTO) ---
elif st.session_state.page == "upload" or st.session_state.page == "cam":
    st.markdown(f"<h3>KI Beleg-Autopilot</h3>", unsafe_allow_html=True)
    
    if st.session_state.page == "cam":
        source = st.camera_input("Rechnung fotografieren")
    else:
        source = st.file_uploader("PDF, Word oder Bild hochladen", type=["pdf", "docx", "jpg", "png"])
    
    if source is not None:
        with st.spinner("KI analysiert das Dokument..."):
            time.sleep(2.5) # KI-Simulationszeit
            ergebnis = {
                "Betrag": random.choice([450.00, 125.50, 89.00]),
                "Typ": random.choice(["Einnahme", "Ausgabe"]),
                "Kategorie": "Instandhaltung / Miete"
            }
            st.balloons()
            st.audio("https://www.soundjay.com/misc/sounds/cash-register-05.mp3")
            
            st.markdown(f"""
                <div style='background: white; padding: 20px; border-radius: 20px; border: 2px solid #27AE60;'>
                    <h4 style='color: #27AE60;'>🎯 KI-Analyse abgeschlossen</h4>
                    <p><b>Betrag erkannt:</b> {ergebnis['Betrag']} €</p>
                    <p><b>Typ:</b> {ergebnis['Typ']}</p>
                    <p><b>Status:</b> Bereit zum Verbuchen in {st.session_state.current_haus}</p>
                </div>
            """, unsafe_allow_html=True)
            
            if st.button("In Tabelle einordnen"):
                st.success("Erfolgreich in die Tabelle verschoben!")
                time.sleep(1.5)
                nav("dash", st.session_state.current_haus)

    if st.button("⬅️ Abbrechen"):
        nav("dash", st.session_state.current_haus)