# ZULU Figma files — master index

**Purpose:** Single source of truth for all Figma file URLs. Claude references this when needing to open a file. User never has to provide the URL again.

| # | File | Purpose | Figma URL | File key | Local spec |
|---|---|---|---|---|---|
| 1 | Zulu1_Components_Colors_Typography | Design system base (tokens, components) | https://www.figma.com/design/A6KZcUWQanpfKiU2jjMYGj/Zulu1_Components_Colors_Typography | `A6KZcUWQanpfKiU2jjMYGj` | [zulu-1-components-tokens.md](specs/zulu-1-components-tokens.md) |
| 2 | Zulu_2_Login_Sign_up | Auth flows (login, signup, 2FA, forgot/reset password) | https://www.figma.com/design/lCwRIXoOYmjiTPSlAckEhW/Zulu_2_Login_Sign_up | `lCwRIXoOYmjiTPSlAckEhW` | [zulu-2-login-signup.md](specs/zulu-2-login-signup.md) |
| 3 | Zulu3_Home_page | Public landing (zulu.am) | https://www.figma.com/design/02fQ1tdpnODhsvgHJp4fGx/Zulu3_Home_page | `02fQ1tdpnODhsvgHJp4fGx` | [zulu-3-home-page.md](specs/zulu-3-home-page.md) |
| 4 | Zulu4_Flights | Flights search/booking | https://www.figma.com/design/JHdcMecJmsSJtFpKltw1bu/Zulu4_Flights | `JHdcMecJmsSJtFpKltw1bu` | [zulu-4-flights.md](specs/zulu-4-flights.md) |
| 5 | Zulu5_Hotels | Hotels search/booking | https://www.figma.com/design/ZiD41EZvbXyYEJUMvLaauY/Zulu5_Hotels | `ZiD41EZvbXyYEJUMvLaauY` | [zulu-5-hotels.md](specs/zulu-5-hotels.md) |
| 6 | Zulu6_Transfer | Transfer service | https://www.figma.com/design/i1smXpRF3jtcpDmqw1I6cb/Zulu6_Transfer | `i1smXpRF3jtcpDmqw1I6cb` | [zulu-6-transfer.md](specs/zulu-6-transfer.md) |
| 7 | Zulu7_Car_rental | Car rental | https://www.figma.com/design/zZlZ7zTrCLIx3EcaGNa5Uh/Zulu7_Car_rental | `zZlZ7zTrCLIx3EcaGNa5Uh` | [zulu-7-car-rental.md](specs/zulu-7-car-rental.md) |
| 8 | Zulu8_Packages | Travel packages | https://www.figma.com/design/xdLcbOxtAnDtoSDnruiMEh/Zulu8_Packages | `xdLcbOxtAnDtoSDnruiMEh` | [zulu-8-packages.md](specs/zulu-8-packages.md) |
| 9 | Zulu9_Excursions | Excursions / tours | https://www.figma.com/design/9G7rO4bwoZ4Q0RsEHHPqcd/Zulu9_Excursions | `9G7rO4bwoZ4Q0RsEHHPqcd` | [zulu-9-excursions.md](specs/zulu-9-excursions.md) |
| 10 | Zulu10_Profile | User profile / account | https://www.figma.com/design/vOVR1omppvSIqPPdzcpisV/Zulu10_Profile | `vOVR1omppvSIqPPdzcpisV` | [zulu-10-profile.md](specs/zulu-10-profile.md) |

## Auxiliary references

| File | Purpose | URL |
|---|---|---|
| Quest CRM Design (Copy) | Admin layout reference (CRM/Mobile App pages) | https://www.figma.com/design/bEqM5rja1g3DjRugNRPjJr/Quest-CRM-Design--Copy- |

## Workflow

1. Claude opens this file when needing a Figma URL — never asks user.
2. To process a file, user opens it in Figma desktop, selects a frame, says "բաց է".
3. Claude calls `mcp__figma__get_metadata` to extract structure, writes spec to `specs/<filename>.md`.
4. Local spec becomes the daily-work reference. Figma is only consulted again if design changes.
