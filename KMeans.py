import pandas as pd
import os

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
# 处理 'index' 和 'Unnamed: 0' 列
if 'index' in combined_df.columns and combined_df['index'].equals(pd.RangeIndex(start=0, stop=len(combined_df))):
    combined_df = combined_df.drop(columns=['index'])
if 'Unnamed: 0' in combined_df.columns:
    combined_df = combined_df.drop(columns=['Unnamed: 0'])
valid_classes = [f'Class{i}' for i in range(1, 15)]
combined_df = combined_df[combined_df['class'].isin(valid_classes)]
combined_df = combined_df.dropna(subset=['student_ID', 'title_ID', 'time', 'score','timeconsume','memory'])
#按student_ID聚类特征
#答题次数
answer_times = combined_df.groupby('student_ID').size().rename('answer_times')
#答题时间段
combined_df['hour'] = pd.to_datetime(combined_df['time'],unit='s').dt.hour
def get_daytime(hour):
    if 7 <= hour < 12:
        return 'morning'
    elif 12 <= hour < 18:
        return 'afternoon'
    elif 18 <= hour < 24:
        return 'evening'
    else: 
        return 'night'
combined_df['daytime'] = combined_df['hour'].apply(get_daytime)
# 统计每个人四段时间的答题比例（morning, afternoon, evening, night）
daytime_dist = pd.crosstab(combined_df['student_ID'], combined_df['daytime'])
daytime_ratio = daytime_dist.div(daytime_dist.sum(axis=1), axis=0)
daytime_ratio.columns = [f'daytime_{col}' for col in daytime_ratio.columns]
#答题持续性
combined_df['date'] = pd.to_datetime(combined_df['time'], unit='s').dt.floor('d')
#print(combined_df['date'])
combined_df = combined_df.sort_values(by=['student_ID', 'date'])
def calculate_consecutive_days(group):
    # 获取每个学生的答题日期，去重后排序
    dates = group['date'].drop_duplicates().sort_values()
    # 计算日期差异
    date_diff = (dates - dates.shift(1)).dt.days
    # 计算连续答题天数（判断日期差异为1的天数）
    consecutive_days = (date_diff == 1).cumsum() + 1  # 连续天数增加
    max_consecutive_days = consecutive_days.max()  # 获取最大连续答题天数
    return max_consecutive_days
# 最大连续答题天数
consecutive_days = combined_df.groupby('student_ID').apply(calculate_consecutive_days).rename('consecutive_days')
# 平均答题间隔
def calculate_avg_gap(group):
    # 获取每个学生的答题日期，去重后排序
    dates = group['date'].drop_duplicates().sort_values()
    # 计算日期差异
    date_diff = (dates - dates.shift(1)).dt.days
    # 计算平均答题间隔
    avg_gap = date_diff.mean() if len(date_diff) > 0 else 0
    return avg_gap
# 平均答题间隔
avg_gap = combined_df.groupby('student_ID').apply(calculate_avg_gap).rename('avg_gap')


#正确率
combined_df['is_Absolutely_Correct'] = (combined_df['state'] == 'Absolutely_Correct').astype(int)
correct_ratio = combined_df.groupby('student_ID')['is_Absolutely_Correct'].mean().rename('correct_ratio')
#平均分
avgScore=(combined_df.groupby('student_ID')['score'].sum()).rename('avgScore')
#题目平均难度
diffcultScore=(avgScore/answer_times*correct_ratio).rename('diffcultScore')
#探索热情
correct_once = combined_df[(combined_df['state'] == 'Absolutely_Correct')].drop_duplicates(['student_ID', 'title_ID'])
combined_df['corrected'] = combined_df.duplicated(['student_ID', 'title_ID']) & (combined_df['state'] == 'Absolutely_Correct')
explore_bonus = combined_df[combined_df['corrected']].groupby('student_ID').size().rename('explore_bonus')

# 去重后的题目数量（学生的广度）
unique_questions_attempted = (
    combined_df.groupby('student_ID')['title_ID']
    .nunique()
    .rename('unique_questions_attempted')
)
# 活跃天数（学习频率）
active_days = (
    combined_df.groupby('student_ID')['date']
    .apply(lambda x: x.dt.normalize().nunique())
    .rename('active_days')
)
#平均每道题尝试次数
avg_attempts_per_unique_question = (answer_times / unique_questions_attempted).rename('avg_attempts_per_unique_question')

# 首次正确率
first_attempts = combined_df.sort_values(by=['student_ID', 'title_ID', 'date']).drop_duplicates(['student_ID', 'title_ID'])
first_attempts['is_first_correct'] = (first_attempts['state'] == 'Absolutely_Correct').astype(int)
first_attempt_accuracy = (
    first_attempts.groupby('student_ID')['is_first_correct']
    .mean()
    .rename('first_attempt_accuracy')
)
#学习时间是否集中
concentration_ratio = (active_days / consecutive_days).rename('concentration_ratio')
# 每个学生答对的唯一题目数
unique_correct_questions = (
    combined_df[combined_df['state'] == 'Absolutely_Correct']
    .drop_duplicates(['student_ID', 'title_ID'])
    .groupby('student_ID')
    .size()
    .rename('unique_correct_questions')
)


features = pd.concat([
    #concentration_ratio.to_frame(),
    #answer_times.to_frame(),
    active_days.to_frame(),
    #first_attempt_accuracy.to_frame(),
    unique_questions_attempted.to_frame(),
    avg_attempts_per_unique_question.to_frame(),
    unique_correct_questions.to_frame(),
    #correct_ratio.to_frame(),
    #avgScore.to_frame(),
    #explore_bonus.to_frame(),
    consecutive_days.to_frame(),
    #diffcultScore.to_frame(),
    #avg_gap.to_frame(),
    #daytime_ratio  # 可选择是否合并
], axis=1).fillna(0)

#features.to_csv('cluster_features.csv')
# 聚类
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans

# 提取用于聚类的特征列
X = features.drop(columns=['cluster'], errors='ignore')  # 防止 cluster 已存在时报错
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)

kmeans = KMeans(n_clusters=3, random_state=42)
features['cluster'] = kmeans.fit_predict(X_scaled)

from sklearn.decomposition import PCA
import matplotlib.pyplot as plt

# from sklearn.metrics import silhouette_score
# silhouette_scores = []
# for i in range(2, 11):  # 轮廓系数计算需要至少2个聚类
#     kmeans = KMeans(n_clusters=i, random_state=42)
#     kmeans.fit(X_scaled)
#     score = silhouette_score(X_scaled, kmeans.labels_)
#     silhouette_scores.append(score)
# plt.plot(range(2, 11), silhouette_scores)
# plt.title('Silhouette Score For Optimal k')
# plt.xlabel('Number of clusters')
# plt.ylabel('Silhouette Score')
# plt.show()

pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_scaled)
features['x'] = X_pca[:, 0]
features['y'] = X_pca[:, 1]
plt.scatter(features['x'] , features['y'], c=features['cluster'], cmap='viridis')
plt.title('Cluster Visualization (PCA)')
plt.xlabel('PC1')
plt.ylabel('PC2')
plt.show()
# import json
# student_cluster_data = features[['x', 'y', 'cluster']].values.tolist()
# with open('student_cluster_data.json', 'w', encoding='utf-8') as f:
#     json.dump(student_cluster_data, f, ensure_ascii=False, indent=4)
    
# plt.scatter(X_scaled[:, 0], X_scaled[:, 1], c=features['cluster'])
# plt.scatter(kmeans.cluster_centers_[:, 0], kmeans.cluster_centers_[:, 1], c='red', marker='x')
# plt.show()
import numpy as np

# # 距离聚类中心最近的学生编号（每类各一个）
# centers = kmeans.cluster_centers_  # 聚类中心（已标准化）
# X = X_scaled  # 已标准化数据

# representatives = []
# for i in range(kmeans.n_clusters):
#     cluster_indices = np.where(features['cluster'] == i)[0]
#     cluster_points = X[cluster_indices]
#     center = centers[i]
    
#     distances = np.linalg.norm(cluster_points - center, axis=1)
#     closest_index = cluster_indices[np.argmin(distances)]
#     representatives.append(closest_index)

# # 查看代表性学生的原始指标
# representative_students = features.iloc[representatives].reset_index()
# representative_students.reset_index(drop=True).to_json('representative_students.json', orient='records', force_ascii=False)
# #print(representative_students)


# 提取每个聚类的特征均值
cluster_centers = pd.DataFrame(scaler.inverse_transform(kmeans.cluster_centers_), columns=X.columns)
cluster_centers['cluster'] = [f"Cluster {i}" for i in range(len(cluster_centers))]
cluster_centers.to_json('cluster_centers.json', orient='records')
print(cluster_centers)


# def plot_multiple_radar(data, categories, title):
#     N = len(categories)
#     angles = np.linspace(0, 2 * np.pi, N, endpoint=False).tolist()
#     angles += angles[:1]  # 闭合角度

#     fig, ax = plt.subplots(figsize=(6, 6), dpi=150, subplot_kw=dict(polar=True))

#     for i, row in data.iterrows():
#         cluster_data = row.values.tolist()
#         cluster_data += cluster_data[:1]  # 闭合数据

#         ax.plot(angles, cluster_data, label=f'Cluster {i}', linewidth=2)
#         ax.fill(angles, cluster_data, alpha=0.25)

#     ax.set_xticks(angles[:-1])
#     ax.set_xticklabels(categories, rotation=45, fontsize=10)
#     ax.set_yticklabels([])

#     ax.set_title(title, size=15, pad=20)
#     ax.legend(loc='upper right', fontsize=10)

#     plt.show()


# # 定义特征类别名称
# categories = features.drop('cluster', axis=1).columns

# # 使用聚类中心来绘制多个聚类对比
# plot_multiple_radar(cluster_centers, categories, 'Clusters Comparison')



















