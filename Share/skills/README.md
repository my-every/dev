# Skills Data

## Overview

This directory contains skill matrix data used for tracking employee competencies and training progress.

## Skill Levels

Skills are rated on a 0-4 scale:

| Level | Color | Label | Description |
|-------|-------|-------|-------------|
| 4 | Green | Expert | Can perform the task expertly and train others to do it |
| 3 | Yellow | Independent | Can perform the task reliably and independently without supervision |
| 2 | Orange | Assisted | Can perform the task but may still need help or supervision |
| 1 | Red | Basic Awareness | Understands the task conceptually but cannot perform without step-by-step guidance |
| 0 | Blue | No Experience | Has never performed the task and requires full training |

## Skill Categories

| Column | Category | Description |
|--------|----------|-------------|
| skill_brand_list | BrandList | Brand list preparation and verification |
| skill_branding | Branding | Component and panel labeling |
| skill_build_up | Build Up | Panel assembly and component mounting |
| skill_wiring | Wiring | Wire routing and termination |
| skill_wiring_ipv | Wiring IPV | Wiring in-process verification |
| skill_box_build | Box Build | Enclosure assembly |
| skill_cross_wire | Cross Wiring | Cross-wiring between panels and enclosures |
| skill_test | Test | Functional and electrical testing |
| skill_pwr_check | PWR Check | Power-on verification and checks |
| skill_biq | BIQ | Built-in Quality checks |
| skill_green_change | Green Change | Engineering change implementation |

## Experience-Based Skill Assignment

Skills are automatically assigned based on years of experience:

| Experience | Base Skill Level | Notes |
|------------|-----------------|-------|
| 10+ years | 4 (Expert) | Full competency across all areas |
| 5-10 years | 4 (Expert) | Expert in core skills, level 3-4 in advanced |
| 2-5 years | 3 (Independent) | Independent in core, level 2 in advanced |
| 1-2 years | 2 (Assisted) | Assisted in most areas |
| 6-12 months | 1-2 | Basic awareness, building competency |
| 0-6 months | 0-1 | Training phase |

## Role Mapping

| CSV Role | System Role | Description |
|----------|-------------|-------------|
| EA | ASSEMBLER | Electrical Assembler |
| QTT | QA | Quality Technician/Tester |
| AC | TEAM_LEAD | Area Coordinator |
| Volt | ASSEMBLER | Contract worker (temporary) |

## Integration

The skills data is merged into `users.csv` with individual skill columns for each category. This allows:

1. **Assignment Routing**: Match workers to tasks based on skill requirements
2. **Training Tracking**: Identify skill gaps and training needs
3. **Workload Balancing**: Consider skill levels when distributing work
4. **Quality Assurance**: Ensure qualified workers perform critical tasks
