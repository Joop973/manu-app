import streamlit as st
import time

# --- DESIGN-KONTROLLE: IVORY & ONYX ---
st.set_page_config(page_title="Manu Finanzen", layout="centered", page_icon="💎")

st.markdown("""
    <style>
    /* Import der Finanz-Schriftart 'Inter' */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

    .stApp { 
        background-color: #FFFFFF; 
        font-family: 'Inter', sans-serif; 
    }

    /* BUTTON-STYLING: EIERSCHALEN-WEISS & SCHWARZE SCHRIFT */
    div.stButton > button {
        background-color: #F5F5DC !important; /* Eierschalenweiß */
        color: #1A1A1A !important;           /* Tiefschwarze Schrift */
        border-radius: 20px !important;      /* Sanfte Abrundung */
        border: 1px solid #E0E0E0 !important;
        height: 4rem !important;
        width: 100% !important;
        font-size: 18px !important;
        font-weight: 700 !important;         /* Extra fett für Lesbarkeit */
        box-shadow: 0 4px 10px rgba(0,0,0,0.05) !important;
        
        /* Sicherstellen, dass die Schrift oben liegt */
        z-index: 999 !important;
        position: relative !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
    }

    /* Hover-Effekt: Etwas dunkleres Eierschalenweiß */
    div.stButton > button:hover {
        background-color: #EDF1D6 !important;
        border: 1px solid #D4AF37 !important;
    }

    /* Overlay / Detail-Box */
    .detail-overlay {
        background-color: #FDFCF0 !important; /* Passend zum Button-Look */
        border: 2px solid #D4AF37 !important;
        border-radius: 25px !important;
        padding: 25px !important;
        color: #1A1A1A !important;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1) !important;
    }

    /* Klare schwarze Schrift für alle Texte */
    h1, h2, h3, p, span { 
        color: #1A1A1A !important; 
        font-family: 'Inter', sans-serif !important;
    }
    
    /* Trennlinie in Gold */
    hr { border: 1px solid #D4AF37; opacity: 0.3; }
    </style>
    """, unsafe_allow_html=True)

# --- APP LOGIK ---
if "page" not in st.session_state: st.session_state.page = "home"
if "selected_data" not in st.session_state: st.session_state.selected_data = None

def navigate(target, data=None):
    st.session_state.page = target
    st.session_state.selected_data = data
    st.rerun()

# --- STARTSEITE ---
if st.session_state.page == "home":
    st.markdown("<h1 style='text-align: center; font-size: 40px;'>💎 MANU</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; font-weight: 600;'>Konto wählen:</p>", unsafe_allow_html=True)
    st.write("---")
    
    if st.button("🏢 SÜDSTRASSE"): navigate("dash", "Südstraße")
    if st.button("🏠 ANNAVEEN / FINKENSTR."): navigate("dash", "Annaveen")

# --- DASHBOARD ---
elif st.session_state.page == "dash":
    st.markdown(f"<h2>{st.session_state.selected_data}</h2>", unsafe_allow_html=True)
    
    month = st.select_slider("Zeitraum wählen", options=["Jan", "Feb", "Mär", "Apr", "Mai", "Jun"])
    
    # EINNAHMEN
    st.markdown("### 📈 EINNAHMEN")
    ein_list = [
        {"name": "Mieter Urfahn", "wert": "750,00 €", "date": "05.05.", "desc": "Zahlung pünktlich erfolgt"},
        {"name": "Mieter Brand", "wert": "850,00 €", "date": "02.05.", "desc": "Miete inkl. Stellplatz"}
    ]
    for e in ein_list:
        c1, c2 = st.columns([3, 1])
        with c1:
            if st.button(f"👤 {e['name']}", key=e['name']): navigate("detail", e)
        with c2:
            st.markdown(f"<p style='color: #27AE60; font-weight: 800; margin-top: 25px;'>{e['wert']}</p>", unsafe_allow_html=True)

    # AUSGABEN
    st.markdown("### 📉 AUSGABEN")
    aus_list = [
        {"name": "Handwerker April", "wert": "-553,00 €", "date": "15.04.", "desc": "Reparatur Dachrinne"},
        {"name": "Versicherung", "wert": "-45,00 €", "date": "01.05.", "desc": "Gebäudeversicherung Allianz"}
    ]
    for a in aus_list:
        c1, c2 = st.columns([3, 1])
        with c1:
            if st.button(f"🛠️ {a['name']}", key=a['name']): navigate("detail", a)
        with c2:
            st.markdown(f"<p style='color: #C0392B; font-weight: 800; margin-top: 25px;'>{a['wert']}</p>", unsafe_allow_html=True)

    st.write("---")
    if st.button("📸 BELEG SCANNEN"): navigate("cam")
    if st.button("⬅️ ZURÜCK"): navigate("home")

# --- DETAIL OVERLAY ---
elif st.session_state.page == "detail":
    d = st.session_state.selected_data
    st.markdown(f"<h2>Details: {d['name']}</h2>", unsafe_allow_html=True)
    
    st.markdown(f"""
        <div class="detail-overlay">
            <p><b>Betrag:</b> <span style="font-size: 22px; font-weight: 800;">{d['wert']}</span></p>
            <p><b>Datum der Buchung:</b> {d['date']}</p>
            <p><b>Zusatzinfo:</b> {d['desc']}</p>
        </div>
    """, unsafe_allow_html=True)
    
    st.image("https://via.placeholder.com/500x350.png?text=BELEG+FOTO", caption="Scan-Vorschau")
    
    if st.button("✅ ZURÜCK"): navigate("dash", st.session_state.selected_data)

# --- KAMERA ---
elif st.session_state.page == "cam":
    st.markdown("<h3>Beleg erfassen</h3>", unsafe_allow_html=True)
    foto = st.camera_input("Kamera")
    if foto:
        st.balloons()
        st.success("Beleg erfolgreich verknüpft!")
        time.sleep(2)
        navigate("dash", "Konto")