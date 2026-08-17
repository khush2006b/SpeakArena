import os
import re

files = [
    "frontend/src/features/teacher/components/dashboard/ActivityFeed.tsx",
    "frontend/src/features/teacher/components/dashboard/DashboardHeader.tsx",
    "frontend/src/features/teacher/components/dashboard/RecentPaymentsTable.tsx",
    "frontend/src/features/teacher/components/dashboard/RevenueChart.tsx",
    "frontend/src/features/teacher/components/dashboard/RightSidebarWidgets.tsx",
    "frontend/src/features/teacher/components/dashboard/StatCards.tsx",
    "frontend/src/features/teacher/components/dashboard/TodaysSchedule.tsx"
]

replacements = [
    (r'"#fff"', '"var(--foreground)"'),
    (r'"#e5e7eb"', '"var(--foreground)"'),
    (r'"#080c14"', '"var(--background)"'),
    (r'"#0b0e18"', '"var(--background)"'),
    (r'"#9ca3af"', '"var(--muted-foreground)"'),
    (r'"#6b7280"', '"var(--muted-foreground)"'),
    (r'"rgba\(255,255,255,0\.03\)"', '"var(--card)"'),
    (r'"rgba\(255,255,255,0\.01\)"', '"var(--muted)"'),
    (r'"rgba\(255,255,255,0\.02\)"', '"var(--muted)"'),
    (r'"rgba\(255,255,255,0\.05\)"', '"var(--border)"'),
    (r'"rgba\(255,255,255,0\.07\)"', '"var(--border)"'),
    (r'"rgba\(255,255,255,0\.1\)"', '"var(--border)"'),
    (r'"rgba\(255,255,255,0\.2\)"', '"var(--border)"'),
]

for file_path in files:
    full_path = f"d:/Desktop/web development/SpeakArena/{file_path}"
    with open(full_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    for old, new in replacements:
        content = re.sub(old, new, content)
    
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content)

print("Done")
