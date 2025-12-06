# triage_agent.py
import os
import sys
from google import genai
from google.genai.errors import APIError

# --- 1. Load All Context Files ---
def load_context_files():
    """Reads all system context files into a single string for the prompt."""
    files_to_read = [
        'app.py',           # The application code
        'docker-compose.yml', # The environment setup/network context
        'crash_log.txt'     # The raw error log from the crashing container
    ]
    
    full_context = "System Context Files:\n\n"
    
    for filename in files_to_read:
        if not os.path.exists(filename):
            print(f"❌ ERROR: Missing context file: {filename}. Please ensure the log file exists.")
            return None

        with open(filename, 'r') as f:
            full_context += f"--- START OF FILE: {filename} ---\n"
            full_context += f.read()
            full_context += f"\n--- END OF FILE: {filename} ---\n\n"
            
    return full_context

# --- 2. The Core Reasoning Prompt ---
def generate_triage_prompt(context):
    """Crafts the highly specific prompt for the Gemini 3 agent."""
    
    # This prompt tells Gemini 3 its role, the goal, and the expected output format.
    prompt = f"""
    You are the **Centralized Debugging Brain**, receiving a structured system state report from a containerized sensor.

    Your task is to analyze the system context and generate a complete, structured fix package that the sensor can automatically execute.

    ### 1. Sensor Report (Input Data)

    System Context:
    {context}
    
    ---
    
    ### 2. Diagnosis and Fix Generation

    1. **Root Cause:** State the single, definitive bug found by correlating the code and environment files.
    2. **Code Patch:** Generate the smallest possible code fix (the corrected line for app.py).
    3. **Verification:** Explain why this fix satisfies the contract between the two components.

    ### 3. Fix Command Output (The Actionable Response)

    Generate the following structured JSON package. This is the exact command you are sending back to the sensor for immediate execution.

    
    """
    return prompt


# --- 3. Run the Agent ---
def run_triage_agent():
    context = load_context_files()
    if not context:
        sys.exit(1) # Exit if logs are missing

    agent_prompt = generate_triage_prompt(context)
    
    # Initialize the Gemini Client
    try:
        # Client automatically picks up the GEMINI_API_KEY environment variable
        client = genai.Client() 
    except Exception as e:
        print("\n--- API KEY ERROR ---")
        print("Please ensure your GEMINI_API_KEY environment variable is set.")
        print(f"Error: {e}")
        sys.exit(1)

    print("🤖 Agent is synthesizing system context and diagnosing crash...")
    print("-" * 50)

    try:
        # Use a powerful model for complex reasoning tasks
        response = client.models.generate_content(
            model='gemini-2.5-pro', # Pro model for complex, cross-domain reasoning
            contents=agent_prompt
        )
        print(response.text)
    except APIError as e:
        print(f"\n--- GEMINI API ERROR ---")
        print(f"An API error occurred: {e}")
        print("Check your API key and network connection.")
    except Exception as e:
        print(f"\n--- UNKNOWN ERROR ---")
        print(f"An unexpected error occurred: {e}")

if __name__ == '__main__':
    run_triage_agent()
