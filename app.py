import streamlit as st
import time
from pipeline import run_research_pipeline # Importing your core logic

# ==========================================
# UI Configuration & Styling
# ==========================================
st.set_page_config(
    page_title="Agentic Research Hub",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for a refined, premium look
st.markdown("""
<style>
    .main .block-container {
        padding-top: 2rem;
        max-width: 1200px;
    }
    h1, h2, h3 {
        color: #1E293B;
        font-family: 'Inter', sans-serif;
    }
    .stAlert {
        border-radius: 8px;
    }
    .report-box {
        background-color: #F8FAFC;
        padding: 2rem;
        border-radius: 12px;
        border: 1px solid #E2E8F0;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .feedback-box {
        background-color: #FEF2F2;
        padding: 1.5rem;
        border-left: 4px solid #EF4444;
        border-radius: 0 8px 8px 0;
        margin-top: 2rem;
    }
</style>
""", unsafe_allow_html=True)

# ==========================================
# Sidebar Settings
# ==========================================
with st.sidebar:
    st.image("https://cdn-icons-png.flaticon.com/512/8633/8633190.png", width=60)
    st.title("System Controls")
    st.markdown("Configure your multi-agent research parameters below.")
    st.divider()
    st.caption("Architecture:")
    st.markdown("- **Search Agent:** Information Retrieval")
    st.markdown("- **Reader Agent:** Deep Scraping")
    st.markdown("- **Writer Agent:** Report Generation")
    st.markdown("- **Critic Agent:** Quality Assurance")
    st.divider()
    st.caption("Powered by LangChain & Mistral")

# ==========================================
# Main Interface
# ==========================================
st.title("🧠 Agentic Research Hub")
st.markdown("Deploy an autonomous multi-agent swarm to conduct comprehensive research, synthesize data, and generate peer-reviewed reports.")

# Input Section
with st.form(key="research_form"):
    topic = st.text_input("Enter Research Topic:", placeholder="e.g., The impact of quantum computing on modern cryptography...", help="Be specific to get a highly targeted report.")
    submit_button = st.form_submit_button("Initialize Research Agents", type="primary", use_container_width=True)

# Execution Logic
if submit_button:
    if not topic.strip():
        st.warning("⚠️ Please provide a valid research topic before initializing the agents.")
    else:
        # Create tabs for structured viewing
        tab_report, tab_logs = st.tabs(["Final Report & Critique", "Agent Execution Logs"])
        
        with tab_logs:
            # We use a status container to show live progress
            with st.status("Deploying Multi-Agent Swarm...", expanded=True) as status:
                
                try:
                    # Inform user the process has started
                    st.write("Initializing `run_research_pipeline`...")
                    
                    # Execute the pipeline (Note: since your original pipeline uses print statements, 
                    # they will show in the terminal. We will display the final state dictionary here.)
                    
                    start_time = time.time()
                    
                    # --- Executing Core Logic ---
                    final_state = run_research_pipeline(topic)
                    
                    end_time = time.time()
                    duration = round(end_time - start_time, 2)
                    
                    status.update(label=f"Research complete in {duration} seconds!", state="complete", expanded=False)
                    
                    # Display Raw Data in Logs Tab
                    st.subheader("Data Retrieval Logs")
                    with st.expander("View Raw Search Results"):
                        st.markdown(final_state.get('search_results', 'No search results available.'))
                        
                    with st.expander("View Scraped Content"):
                        st.text(final_state.get('scraped_content', 'No scraped content available.'))
                        
                except Exception as e:
                    status.update(label="System Error Encountered", state="error", expanded=True)
                    st.error(f"Pipeline execution failed: {str(e)}")
                    st.stop()

        # Display Final Output in the main tab
        with tab_report:
            st.success("Report Generation Successful")
            
            # Formatted Report
            st.markdown("### Synthesized Research Report")
            st.markdown(f'<div class="report-box">{final_state.get("report", "Report generation failed.")}</div>', unsafe_allow_html=True)
            
            # Formatted Critic Feedback
            st.markdown("### Critic Agent Review")
            st.markdown(f'<div class="feedback-box"><strong>Quality Assessment:</strong><br><br>{final_state.get("feedback", "No feedback generated.")}</div>', unsafe_allow_html=True)

# Footer
st.divider()
st.caption("© 2026 Multi-Agent Research System | Built with Streamlit")