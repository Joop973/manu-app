import streamlit as st
import pandas as pd
import time
import random
import streamlit.components.v1 as components

# --- KONTROLLE & DESIGN ---
st.set_page_config(page_title="Manu Imperial OS", layout="centered", page_icon="🏛️")

# --- SOUND-ENGINE (JavaScript für haptisches Feedback) ---
# Dieser Code sorgt dafür, dass bei JEDEM Button-Klick im Browser ein Sound abgespielt wird.
components.html(
    """
    <audio id="clickSound" src="https://www.soundjay.com/buttons/sounds/button-16.mp3" preload="auto"></audio>
    <script>
    const playSound = () => {
        const audio = window.parent.document.getElementById('clickSound');
        audio.play();
    }
    // Suche alle Buttons und füge den Sound-Event hinzu
    const buttons = window.parent.document.getElementsByTagName('button');
    for (let i = 0; i < buttons.length; i++) {
        buttons[i].addEventListener('click', playSound);
    }
    </script>
    """,
    height=0,
)

st.markdown("""
    <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Inter:wght@400;700&display=swap');

    .stApp { background: radial-gradient(circle, #1a1a1a 0%, #050505 100%); font-family: 'Inter', sans-serif; }

    /* Imperialer Header */
    .header-gold {
        font-family: 'Cinzel', serif;
        color: #D4AF37;
        text-align: center;
        font-size: 3rem;
        text-shadow: 0px 0px 15px rgba(212, 175, 55, 0.6);
        margin-bottom: 30px;
    }

    /* Casino-Chip Buttons mit Schatten-Tiefe */
    div.stButton > button {
        background: linear-gradient(145deg, #D4AF37, #8A6D1D) !important;
        color: #000 !important;
        border-radius: 12px !important;
        border: 2px solid #FFD700 !important;
        height: 3.5rem !important;
        font-weight: 800 !important;
        box-shadow: 0 5px 0 #5C4914 !important; /* 3D Effekt unten */
        transition: 0.1s all;
        text-transform: uppercase;
        width: 100% !important;
    }

    /* Klick-Animation (Button geht nach unten) */
    div.stButton > button:active {
        transform: translateY(4px) !important;
        box-shadow: 0 1px 0 #5C4914 !important;
    }

    /* Oracle Card Design */
    .oracle-box {
        background: rgba(212, 175, 55, 0.1);
        border: 1px solid #D4AF37;
        padding: 20px;
        border-radius: 15px;
        color: #D4AF37;
        font-style: italic;
    }
    </style>
    """, unsafe_allow_html=True)

# --- APP LOGIK ---
if "logged_in" not in st.session_state: st.session_state.logged_in = False

# --- SIMPLE LOGIN ---
if not st.session_state.logged_in:
    st.markdown("<div class='header-gold'>MARCUS AURELIUS FINANCE</div>", unsafe_allow_html=True)
    with st.container():
        st.text_input("Imperator Name")
        st.text_input("Vault Key", type="password")
        if st.button("BETRETE DEN PALAST"):
            st.session_state.logged_in = True
            st.rerun()
    st.stop()

# --- SIDEBAR NAVIGATION ---
with st.sidebar:
    st.markdown("<h2 style='color:#D4AF37;'>🏛️ PALAST-MENÜ</h2>", unsafe_allow_html=True)
    choice = st.radio("Wohin gehst du?", ["Hauptsaal (Zentrale)", "Das Orakel (KI Tipps)", "Miet-Tresor"])
    st.markdown("---")
    if st.button("🚪 Palast verlassen"):
        st.session_state.logged_in = False
        st.rerun()

# --- HAUPTSAAL ---
if choice == "Hauptsaal (Zentrale)":
    st.markdown("<div class='header-gold'>ZENTRALE</div>", unsafe_allow_html=True)
    
    col1, col2 = st.columns(2)
    with col1:
        if st.button("🏦 SÜDSTRASSE"): st.toast("Lade Südstraße...")
        if st.button("🏠 FINKENSTRASSE"): st.toast("Lade Finkenstraße...")
    with col2:
        if st.button("🌿 ANNAFEHN"): st.toast("Lade Annafehn...")
        if st.button("➕ NEUES HAUS"): st.info("Baupläne werden erstellt...")

    st.markdown("---")
    # Casino Win Sound beim Scan
    if st.button("📸 KI BELEG SCAN (JACKPOT)"):
        with st.spinner("KI berechnet Gewinn..."):
            time.sleep(1.5)
            st.balloons()
            # Slot Machine Sound Effekt
            st.audio("https://www.soundjay.com/misc/sounds/bell-ringing-05.mp3") 
            st.success("Beleg erkannt! +1.240€ in den Tresor gelegt.")

# --- DAS ORAKEL ---
elif choice == "Das Orakel (KI Tipps)":
    st.markdown("<div class='header-gold'>DAS ORAKEL</div>", unsafe_allow_html=True)
    st.markdown("""
        <div class='oracle-box'>
            "Ich sehe dunkle Wolken über deinem Goldvorrat... Deine Ausgaben bei 'Cardmarket' (290€) 
            sind für einen Imperator nicht würdig. Investiere in Steine, nicht in Papier."
        </div>
    """, unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    st.markdown("""
        <div class='oracle-box'>
            "Deine morgendlichen Opfergaben beim Bäcker (20€ täglich) summieren sich zu einem Berg. 
            Mäßigung führt zu Reichtum."
        </div>
    """, unsafe_allow_html=True)