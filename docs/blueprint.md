# **App Name**: SovereignRating Hub

## Core Features:

- Country & Fact Sheet Data Management: Allows users to add, edit, and view countries, and input comprehensive sovereign data (economic, fiscal, external, etc.) through structured fact sheets, stored and retrieved from Firestore.
- Dynamic Rating Model & Scale Selector: Enables users to select from multiple predefined sovereign credit rating models (e.g., US-type, UK-type) and various rating scales (Standard, Numeric, Moodys) to apply to country data.
- Comprehensive Rating Calculation Engine: Executes the selected rating model, performing all derived metric computations (e.g., Debt/GDP), transforming values into scores (1-5), applying specific weights per model, aggregating the scores, and mapping to the chosen rating scale to produce an initial rating.
- Transparent Rating Breakdown Display: Presents a full, interactive breakdown of the rating calculations, showing raw data, derived metrics, individual scores, applied weights, and weighted contributions leading to the final aggregated score and initial rating.
- Rating Adjustment & Approval Workflow: Provides functionality to manually apply downgrades or upgrades to the initial rating, override the final rating, and manage the approval status with mandatory reason entry, ensuring an auditable workflow.
- AI-Powered Rating Rationale Generator: An AI tool that automatically generates a clear, concise narrative explanation and justification for a country's assigned sovereign credit rating, based on the model's calculations, key influencing factors, and any adjustments made.
- Rating History & Dashboard Overview: Displays an administrative dashboard with key statistics (e.g., countries rated, pending approvals) and allows users to view a comprehensive history of ratings for each country.

## Style Guidelines:

- Color scheme: Light mode. Primary color: A deep, professional blue (#1F4793) to convey trust and stability, serving as a prominent color for interactive elements and key headings. Background color: A very light, desaturated cool grey (#F0F2F5) providing a clean canvas for data-heavy content. Accent color: A bright, clear sky blue (#6DDFFB) used sparingly for highlights, calls-to-action, and to draw attention to dynamic information, offering a refreshing contrast.
- Body and headline font: 'Inter' (sans-serif). This choice ensures excellent readability for both short titles and dense financial data tables, offering a clean, modern, and objective feel fitting for a financial dashboard.
- Use minimalist, clear, and functional icons to complement the financial dashboard UI. Icons should be easily understandable and support efficient navigation and data representation.
- Emphasize a clean, organized, and grid-based layout for financial dashboards. Prioritize clarity and scannability, especially for tables displaying raw data, derived metrics, scores, and weighted calculations. Utilize card-like structures to group related information.
- Incorporate subtle and purposeful animations for user feedback, such as on form submissions, successful calculations, or when navigating between rating stages. Animations should be fluid but not distracting, aiding user comprehension without impeding workflow speed.