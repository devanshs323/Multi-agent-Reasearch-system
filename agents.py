# from langchain.agents import create_agent
# from langchain_mistralai import ChatMistralAI
# from langchain_core.prompts import ChatPromptTemplate
# from langchain_core.output_parsers import StrOutputParser
# from tools import web_search,scrape_url
# import os
# from dotenv import load_dotenv


# llm = ChatMistralAI(model="open-mistral-7b", temperature=0)


# def build_search_agent():
#     return create_agent(
#         model= llm,
#         tools = [web_search]
#     )

# def build_reader_agent():
#     return create_agent(
#         model= llm,
#         tools = [scrape_url]
#     )




# writer_prompt = ChatPromptTemplate.from_messages([
#     ("system", "You are an expert research writer. Write clear, structured and insightful reports."),
#     ("human", """Write a detailed research report on the topic below.

# Topic: {topic}

# Research Gathered:
# {research}

# Structure the report as:
# - Introduction
# - Key Findings (minimum 3 well-explained points)
# - Conclusion
# - Sources (list all URLs found in the research)

# Be detailed, factual and professional."""),
# ])

# writer_chain = writer_prompt | llm | StrOutputParser()




# critic_prompt = ChatPromptTemplate.from_messages([
#      ("system", "You are a sharp and constructive research critic. Be honest and specific."),
#     ("human", """Review the research report below and evaluate it strictly.

# Report:
# {report}

# Respond in this exact format:

# Score: X/10

# Strengths:
# - ...
# - ...

# Areas to Improve:
# - ...
# - ...

# One line verdict:
# ..."""),
# ])

# critic_chain = critic_prompt | llm | StrOutputParser()


import os
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain_mistralai import ChatMistralAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from tools import web_search, scrape_url

load_dotenv()

# Added max_retries and timeout to prevent 429 Rate Limit crashes
llm = ChatMistralAI(
    model="open-mistral-7b",
    temperature=0,
    max_retries=5,
    timeout=120
)

def build_search_agent():
    return create_agent(
        model=llm,
        tools=[web_search]
    )

def build_reader_agent():
    return create_agent(
        model=llm,
        tools=[scrape_url]
    )

# Executive-grade Writer Prompt with Tables & Callout Blocks
writer_prompt = ChatPromptTemplate.from_messages([
    ("system", """You are a Principal Research Analyst at an elite global intelligence firm. 
Synthesize the provided research into an executive-grade, visually structured Markdown report.

Strict Formatting Rules:
1. Start immediately after the H1 title with a blockquote (`> **Executive Briefing:** ...`) summarizing the core thesis in 2-3 high-impact sentences.
2. Include at least one Markdown comparison or metrics table (`| Metric / Sector | Impact / Data | Key Driver |`) to make the report scannable.
3. Use numbered `##` headings, concise bullet points with **Bold Lead-ins**, and zero fluff.
4. Cite specific numbers, dates, and URLs from the context. Never invent facts."""),
    ("human", """Write a comprehensive research report on the topic below.

Topic: {topic}

Research Gathered:
{research}

Required Structure:
# [Compelling Report Title]
> **Executive Briefing:** [2-3 sentence high-level synthesis]

## 1. Introduction & Context
## 2. Quantitative & Sectoral Breakdown (Include a Markdown Table here)
## 3. Core Strategic Findings (Minimum 3 deep-dive points)
## 4. Future Outlook & Actionable Roadmap
## 5. Verified Sources (Clickable Markdown links)""")
])

writer_chain = writer_prompt | llm | StrOutputParser()

# Structured Adversarial Critic Prompt
critic_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are an Adversarial Peer-Review Auditor. Evaluate the research report strictly for factual density, analytical rigor, and blindspots."),
    ("human", """Review the research report below and evaluate it strictly.

Report:
{report}

Respond in this EXACT Markdown format:

Score: X.X/10

> **One-Line Verdict:** [Crisp, authoritative summary of the report's quality]

| Evaluation Dimension | Rating (/10) | Key Observation |
| :--- | :--- | :--- |
| Quantitative Depth | X/10 | [Short assessment] |
| Source Authority | X/10 | [Short assessment] |
| Analytical Nuance | X/10 | [Short assessment] |

### Core Strengths
- **[Strength 1]:** [1-sentence explanation]
- **[Strength 2]:** [1-sentence explanation]
- **[Strength 3]:** [1-sentence explanation]

### Critical Blindspots & Refinements
- **[Gap 1]:** [Specific missing data or counter-perspective + exact fix]
- **[Gap 2]:** [Specific missing data or counter-perspective + exact fix]
- **[Gap 3]:** [Specific missing data or counter-perspective + exact fix]""")
])

critic_chain = critic_prompt | llm | StrOutputParser()