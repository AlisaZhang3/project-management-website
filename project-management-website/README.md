# Project Management Website

## Overview
This project is a web application designed for project management, focusing on employee information, client management, project quotations, and invoicing. It aims to streamline the process of tracking employee status, client details, project profitability, and monthly invoicing.

## Features
- **Employee Management**: View and edit employee information, including hire and termination dates, and salary details.
- **Client Management**: Manage client information and track interactions.
- **Project Management**: Overview of projects, including details and statistics.
- **Quotations**: Create and manage project quotations.
- **Invoices**: Generate and view invoices related to projects.
- **Reports**: Generate reports on projects, employees, and financials.

## Project Structure
```
project-management-website
├── client                # Frontend application
│   ├── src
│   │   ├── components    # Reusable components
│   │   ├── pages         # Application pages
│   │   ├── services      # API services
│   │   ├── types         # TypeScript types
│   │   └── App.tsx       # Main entry point
│   ├── package.json      # Client dependencies and scripts
│   └── tsconfig.json     # TypeScript configuration
├── server                # Backend application
│   ├── src
│   │   ├── controllers   # Business logic for routes
│   │   ├── models        # Data structures and schemas
│   │   ├── routes        # API endpoints
│   │   ├── services      # Business logic and database interactions
│   │   ├── database      # Database connection and configuration
│   │   └── app.ts        # Main entry point
│   ├── tests             # Server tests
│   ├── package.json      # Server dependencies and scripts
│   └── tsconfig.json     # TypeScript configuration
├── README.md             # Project documentation
└── .gitignore            # Files to ignore in version control
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the client directory and install dependencies:
   ```
   cd client
   npm install
   ```
3. Navigate to the server directory and install dependencies:
   ```
   cd ../server
   npm install
   ```
4. Start the server:
   ```
   npm start
   ```
5. Start the client application:
   ```
   cd ../client
   npm start
   ```

## Usage
- Access the client application in your web browser at `http://localhost:3000`.
- Use the provided features to manage employees, clients, projects, quotations, and invoices.

## Database
- The server uses the SQLite database built into Node.js; Node.js 22.5 or newer is required.
- Data is persisted in `server/data/project-management.db` and remains available after the server restarts.
- Project, employee, profitability, client, quotation, and invoice records are all stored in this database.
- To back up the application, stop the server and copy `server/data/project-management.db`.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License.