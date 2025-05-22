import json
from collections import defaultdict
import pandas as pd

# 读取你的数据
data = json.load(open('student_kp_stats.json', 'r', encoding='utf-8'))
df = pd.DataFrame(data)
df[['major', 'minor']] = df['knowledge_point_whole'].str.split('-', expand=True)

# 聚合数据
student_data = {}
for student_id, group in df.groupby('student_ID'):
    # 计算主知识点平均得分（内圈）
    inner = group.groupby('major')['normalized_score'].mean().reset_index()
    inner = [{'name': row['major'], 'value': round(row['normalized_score'], 3)} for _, row in inner.iterrows()]
    
    # 子知识点得分（外圈）
    outer = group[['minor', 'normSalized_score', 'major']].copy()
    outer = [{'name': row['minor'], 'value': round(row['normalized_score'], 3), 'parent': row['major']} for _, row in outer.iterrows()]
    
    student_data[student_id] = {
        'inner': inner,
        'outer': outer
    }

# 输出数据以供 ECharts 使用
with open('student_kp_rose_data.json', 'w', encoding='utf-8') as f:
    json.dump(student_data, f, indent=4, ensure_ascii=False)
