import pandas as pd
import numpy as np
import os

# 1. 读取数据
questions_df = pd.read_csv('first_data\Ⅰ时序多变量教育数据可视分析挑战赛_数据\Data_TitleInfo.csv')

# 所有 CSV 所在文件夹路径
folder_path = 'first_data/Ⅰ时序多变量教育数据可视分析挑战赛_数据/Data_SubmitRecord/'  
# 读取所有 CSV
all_dfs = []
for filename in os.listdir(folder_path):
    if filename.endswith('.csv'):
        df = pd.read_csv(os.path.join(folder_path, filename))
        if 'index' in df.columns:
            df = df.drop(columns=['index'])
        all_dfs.append(df)

# 合并为一个总表
combined_df = pd.concat(all_dfs, ignore_index=True)
#清洗处理异常
# 将非法字符（如 "--", "N/A", "", 等）统一设为 NaN
combined_df['timeconsume'] = pd.to_numeric(combined_df['timeconsume'], errors='coerce')
combined_df['memory'] = pd.to_numeric(combined_df['memory'], errors='coerce')
combined_df = combined_df.dropna(subset=['timeconsume', 'memory'])
# 处理 'index' 和 'Unnamed: 0' 列
if 'index' in combined_df.columns and combined_df['index'].equals(pd.RangeIndex(start=0, stop=len(combined_df))):
    combined_df = combined_df.drop(columns=['index'])
if 'Unnamed: 0' in combined_df.columns:
    combined_df = combined_df.drop(columns=['Unnamed: 0'])
valid_classes = [f'Class{i}' for i in range(1, 15)]
combined_df = combined_df[combined_df['class'].isin(valid_classes)]
combined_df = combined_df.dropna(subset=['student_ID', 'title_ID', 'time', 'score','timeconsume','memory'])
combined_df.rename(columns={'score': 'answer_score'}, inplace=True)
# 合并题目信息到答题记录中
merged = combined_df.merge(questions_df, on='title_ID', how='left')
#print(merged['memory'])


# 构造 knowledge_point 字段（主知识点 + 次知识点）
merged['knowledge_point'] = merged['knowledge'].fillna('') #+ '-' + merged['sub_knowledge'].fillna('')
#merged['knowledge_point_whole'] = merged['knowledge'].fillna('') + '-' + merged['sub_knowledge'].fillna('')

# 归一化得分（可以用最大分为 100，也可以用实际最高分）
merged['normalized_score'] = merged['answer_score'] / merged['answer_score'].max()
merged['normalized_score'] = merged['normalized_score'].clip(0, 1)

# 计算每个知识点的平均掌握度（得分角度）
knowledge_avg_score = merged.groupby('knowledge_point')['normalized_score'].mean().sort_values(ascending=False)

# 如果你想用“正确率”来衡量掌握程度：
# 假设 answers_df 中有 state 或 state_category，值为 'correct' / 'wrong' 等
merged['is_correct'] = (merged['state'] == 'Absolutely_Correct').astype(int)
knowledge_accuracy = merged.groupby('knowledge_point')['is_correct'].mean().sort_values(ascending=False)
#时空复杂度
avg_tc_per_title = merged.groupby('knowledge_point')['timeconsume'].mean().rename('avg_tc')
avg_mem_per_title = merged.groupby('knowledge_point')['memory'].mean().rename('avg_mem')
# 归一化函数（Min-Max）
def min_max_normalize(series):
    return (series - series.min()) / (series.max() - series.min())
avg_tc_per_title=min_max_normalize(avg_tc_per_title)
avg_mem_per_title=min_max_normalize(avg_mem_per_title)


# 合并
knowledge_mastery_summary = pd.DataFrame({
    'avg_normalized_score': knowledge_avg_score,
    'accuracy_rate': knowledge_accuracy,
    'avg_timeconsume': avg_tc_per_title,
    'avg_memory': avg_mem_per_title
 })
#print(knowledge_mastery_summary)
knowledge_mastery_summary.reset_index(inplace=True)  # 确保 knowledge_point 是列
#knowledge_mastery_summary.to_json('main_knowledge_mastery_summary.json', orient='records')

#次要知识点
grouped = merged.groupby(['knowledge', 'sub_knowledge'])
summary = grouped.agg({
    'normalized_score': 'mean',
    'is_correct': 'mean',
    'timeconsume': 'mean',
    'memory': 'mean'
}).reset_index()
# Min-Max 归一化处理
from sklearn.preprocessing import MinMaxScaler

# 需要归一化的列
cols_to_normalize = ['normalized_score', 'is_correct', 'timeconsume', 'memory']

# 创建归一化器并应用
scaler = MinMaxScaler()
summary[cols_to_normalize] = scaler.fit_transform(summary[cols_to_normalize])
# 重命名列
summary.rename(columns={
    'normalized_score': 'avg_normalized_score',
    'is_correct': 'accuracy_rate',
    'timeconsume': 'avg_timeconsume',
    'memory': 'avg_memory'
}, inplace=True)
#print(summary)
# 创建文件夹保存 JSON 文件
output_dir = 'knowledge_groups'
#os.makedirs(output_dir, exist_ok=True)

# 按 knowledge 分组，导出每组为一个 JSON 文件
for knowledge, group_df in summary.groupby('knowledge'):
    # 用知识点名命名文件（防止非法字符）
    filename = f"{knowledge.strip().replace('/', '_').replace(' ', '_')}.json"
    filepath = os.path.join(output_dir, filename)
    
    # 重置索引并导出
    #group_df.reset_index(drop=True).to_json(filepath, orient='records', force_ascii=False)

#读取代表性学生列表
rep_students = pd.read_json('representative_students.json')
rep_ids = rep_students['student_ID'].unique()

#筛选出 merged 中这些学生的记录（假设 merged 已加载为 DataFrame）
rep_data = merged[merged['student_ID'].isin(rep_ids)].copy()
# 得分归一化（避免高分权重过大）
rep_data['normalized_score'] = rep_data['answer_score'] / rep_data['answer_score'].max()
rep_data['normalized_score'] = rep_data['normalized_score'].clip(0, 1)

# 正确性
rep_data['is_correct'] = (rep_data['state'] == 'Absolutely_Correct').astype(int)

#按学生 & 知识点聚合统计
# student_kp_stats = rep_data.groupby(['student_ID', 'knowledge_point']).agg({
#     'normalized_score': 'mean',
#     'is_correct': 'mean',
#     'timeconsume': 'mean',
#     'memory': 'mean'
# }).reset_index()
# print(student_kp_stats)
rep_data['knowledge_point_whole'] = rep_data['knowledge'].fillna('') + '-' + rep_data['sub_knowledge'].fillna('')
student_kp_stats = rep_data.groupby(['student_ID', 'knowledge_point_whole']).agg({
    'normalized_score': 'mean',
    'is_correct': 'mean',
    'timeconsume': 'mean',
    'memory': 'mean'
}).reset_index()
#print(student_kp_stats)
student_kp_stats.to_json('student_kp_stats.json', orient='records')
# import matplotlib.pyplot as plt
# #可视化各知识点掌握度
# summary.sort_values(by='avg_normalized_score').plot(kind='bar', figsize=(12, 6))
# plt.title('知识点掌握度分布')
# plt.xlabel('知识点')
# plt.ylabel('平均掌握度')
# plt.xticks(rotation=90)
# plt.show()
