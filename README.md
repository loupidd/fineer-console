# Fineer Console  
A Role-Based Workforce Management Platform

Fineer Console is the web companion to the Fineer mobile attendance ecosystem used at PT. Sumber Sarana Solusindo. It provides a centralized platform for managing attendance records, processing employee forms, handling approvals, and maintaining user data across the organization.

## Overview

The system supports three distinct roles with tailored access levels: Employee, Admin, and Director. It streamlines operational workflows by connecting form submission, verification, approval, and reporting into a single end-to-end pipeline.

Fineer Console also includes a lightweight CMS that allows non-technical staff to update the company's website content without writing code.

## Key Features

### Role-Based Access and Workflow

**Employee (Pegawai)**  
- Submit Overtime, Leave, and Permission forms.  
- Automatically computed durations based on input.  
- Track real-time status updates for all submissions.

**Admin**  
- Verify, edit, and forward employee forms to the Director.  
- Manage Fineer mobile app users through full CRUD operations.  
- Generate daily, monthly, and yearly reports for specific employees or the entire organization.  
- Oversee all submissions to ensure consistent and accurate record-keeping.

**Director (Direktur)**  
- Approve or reject forms after Admin verification.  
- Access audit-ready submission logs for decision making.

### Reporting System

Fineer Console includes flexible reporting tools capable of producing daily, monthly, and yearly attendance summaries. Reports can be filtered per employee or company-wide.  
This structure supports auditing, performance tracking, and operational oversight.

### Landing Page CMS

The built-in CMS allows Admins to update the corporate website without developer involvement.  
Features include:  
- Uploading images  
- Editing service card titles and descriptions  
- Immediate publishing with auto-layout  
This enables faster content changes and reduces bottlenecks in internal workflows.

## Tech Stack

- Svelte  
- JavaScript / TypeScript  
- Firebase Authentication  
- Firebase Firestore  
- Firebase Storage  
- TailwindCSS  
- Vite


## Purpose

Fineer Console was developed to digitize and modernize internal operational processes, 
