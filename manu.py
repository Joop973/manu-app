import streamlit as st
import pandas as pd

# --- CONFIGURATION ---
st.set_page_config(page_title="Manu Finanzen", layout="centered", page_icon="💎")

# --- ADVANCED STYLING (THE MILLION DOLLAR LOOK) ---
st.markdown("""
    <style>
    /* Hintergrund & Font */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
    
    .stApp { background-color: #F8F9FA; font-family: 'Inter', sans-serif; }
    
    /* Maximale Lesbarkeit für Text */
    h1, h2, h3, p, span, div { color: #1A1A1A !important; }
    
    /* Die "Edle Karte" */
    .finance-card {
        background: white;
        border-radius: 24px;
        padding: 20px;
        margin-bottom: 15px;
        border: 1px solid #E0E0E0;
        box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    
    /* Farb-Indikatoren für Einnahmen/Ausgaben */
    .indicator-plus { border-left: 8px solid #2ECC71 !important; background-color: #F0FFF4 !important; }
    .indicator-minus { border-left: 8px solid #E74C3C !important; background-color: #FFF5F5 !important; }

    /* Buttons: Groß, Schwarz, Kontrastreich */
    .stButton>button {
        width: 100%; border-radius: 16px; height: 60px;
        background-color: #1A1A1A; color: white !important;
        font-weight: 600; font-size: 18px; border: none;
        margin-top: 10px;
    }
    
    /* Overlay / Detail-Ansicht */
    .detail-box {
        background: white; border: 2px solid #D4AF37;
        border-radius: 20px; padding: 25px; margin-top: 20px;
    }

    /* Tabellen-Schriftgröße optimieren */
    .stDataFrame div[data-testid="stTable"] { font-size: 18px !important; }
    </style>
    """, unsafe_allow_html=True)

# --- APP LOGIK ---
if "page" not in st.session_state: st.session_state.page = "home"
if "selected_item" not in st.session_state: st.session_state.selected_item = None

def navigate(page, item=None):
    st.session_state.page = page
    st.session_state.selected_item = item

# --- HOME: KONTOAUSWAHL ---
if st.session_state.page == "home":
    st.markdown("<h1 style='text-align: center; font-weight: 800; font-size: 42px;'>💎 Manu</h1>", unsafe_allow_html=True)
    st.markdown("<p style='text-align: center; font-size: 18px;'>Wähle ein Konto zur Verwaltung</p>", unsafe_allow_html=True)
    st.write("---")
    
    if st.button("🏦 Südstraße (Konto B)"): navigate("dash", "Südstraße")
    if st.button("🏠 Annaveen & Finkenstraße"): navigate("dash", "Haus A")

# --- DASHBOARD: MOBILE OPTIMIERTE ÜBERSICHT ---
elif st.session_state.page == "dash":
    st.markdown(f"<h2 style='font-weight: 800;'>{st.session_state.selected_item}</h2>", unsafe_allow_html=True)
    
    # Monats-Auswahl (Groß & Sauber)
    month = st.select_slider("", options=["Januar", "Februar", "März", "April", "Mai", "Juni"])
    
    # --- EINNAHMEN SEKTION (Mint-Weiß, Schwarze Schrift) ---
    st.markdown("### 📈 Einnahmen")
    einnahmen = [
        {"Name": "Mieter Urfahn", "Betrag": "750,00 €", "Datum": "03.04.2026", "Details": "Kaltmiete + NK"},
        {"Name": "Mieter Brand", "Betrag": "850,00 €", "Datum": "01.04.2026", "Details": "Kaltmiete"}
    ]
    
    for e in einnahmen:
        with st.container():
            col1, col2 = st.columns([3, 1])
            with col1:
                if st.button(f"👤 {e['Name']}", key=e['Name']): navigate("detail", e)
            with col2:
                st.markdown(f"<div style='padding-top: 25px; font-weight: 800; color: #27AE60 !important;'>{e['Betrag']}</div>", unsafe_allow_html=True)

    # --- AUSGABEN SEKTION (Puder-Rosa, Schwarze Schrift) ---
    st.markdown("### 📉 Ausgaben")
    ausgaben = [
        {"Name": "Handwerker Schulze", "Betrag": "-553,00 €", "Datum": "12.04.2026", "Details": "Dachrinnenreinigung, Rechnung Nr. 442"},
        {"Name": "Versicherung", "Betrag": "-45,20 €", "Datum": "05.04.2026", "Details": "Gebäudeversicherung Allianz"}
    ]
    
    for a in ausgaben:
        with st.container():
            col1, col2 = st.columns([3, 1])
            with col1:
                if st.button(f"🛠️ {a['Name']}", key=a['Name']): navigate("detail", a)
            with col2:
                st.markdown(f"<div style='padding-top: 25px; font-weight: 800; color: #C0392B !important;'>{a['Betrag']}</div>", unsafe_allow_html=True)

    st.write("---")
    if st.button("📸 BELEG SCANNEN"): navigate("cam")
    if st.button("⬅️ Zurück"): navigate("home")

# --- DETAIL ANSICHT (OVERLAY) ---
elif st.session_state.page == "detail":
    item = st.session_state.selected_item
    st.markdown(f"<h2 style='font-weight: 800;'>Details: {item['Name']}</h2>", unsafe_allow_html=True)
    
    st.markdown(f"""
        <div class="detail-box">
            <p><b>Betrag:</b> <span style="font-size: 24px;">{item['Betrag']}</span></p>
            <p><b>Datum:</b> {item['Datum']}</p>
            <p><b>Beschreibung:</b> {item['Details']}</p>
        </div>
    """, unsafe_allow_html=True)
    
    # Platzhalter für das Beleg-Bild
    st.image("https://via.placeholder.com/600x400.png?text=FOTO+DES+BELEGS", use_container_width=True)
    
    if st.button("✅ Verstanden"): navigate("dash", "Zurück")

# --- KAMERA ---
elif st.session_state.page == "cam":
    st.markdown("<h2 style='text-align: center;'>Beleg fotografieren</h2>", unsafe_allow_html=True)
    img = st.camera_input("Kamera")
    if img:
        st.balloons()
        st.success("Beleg gespeichert!")
        time.sleep(2)
        navigate("dash", "Konto A")