# Data Directory Guide

## Folder Layout
- Store all customer artifacts under `/data/reachnett/<customer_name>/<companycode>/<module_name>.json`.
- Example for payroll area data: `/data/reachnett/customer1/1000/payrollarea.json`.

## Customer Root Extras
Each customer root folder must include:
- `company.logo.jpg` — used for future login branding.
- `company.info.json` — contains common company metadata (list of company codes, company names, addresses, etc.).

These extras allow us to preload branding and context before showing any module data.

## User Management Requirements
- Implement a user management module supporting login and role management (`admin`, `customer`).
- Customers can access only their own folder under `/data/reachnett`.
- Admins can access every company. After an admin logs in, they should choose which customer to work on, so we need the ability to list all customers.

## Temporary Convention
Until the full user management system ships, use `default` as the customer folder name (e.g., `/data/reachnett/default/<companycode>/<module_name>.json`).
