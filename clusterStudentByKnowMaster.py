import pandas as pd
import numpy as np
import os
from sklearn.preprocessing import MinMaxScaler, LabelEncoder
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score
import matplotlib
matplotlib.use('TkAgg')  # 指定使用TkAgg后端
import matplotlib.pyplot as plt
import seaborn as sns
from mpl_toolkits.mplot3d import Axes3D

# # 设置数据文件夹路径
# data_folder = os.path.abspath('first_data/Data_SubmitRecord')

# # 获取文件夹中所有的CSV文件
# csv_files = [os.path.join(data_folder, file) for file in os.listdir(data_folder) if file.endswith('.csv')]

# # 初始化一个空的DataFrame用于存储合并后的数据
# all_data = pd.DataFrame()

# # 遍历所有CSV文件并读取它们
# for csv_file in csv_files:
#     # 读取CSV文件
#     df = pd.read_csv(csv_file)
#     # 将读取的数据添加到all_data DataFrame中
#     all_data = pd.concat([all_data, df], ignore_index=True)

# # 显示合并后的DataFrame的前几行数据以确认读取成功
# print(all_data.head())

# 所有 CSV 所在文件夹路径
folder_path = 'first_data/Ⅰ时序多变量教育数据可视分析挑战赛_数据/Data_SubmitRecord/'  # 你放CSV的路径
# 读取所有 CSV
all_dfs = []
for filename in os.listdir(folder_path):
    if filename.endswith('.csv'):
        df = pd.read_csv(os.path.join(folder_path, filename))
        if 'index' in df.columns:
            df = df.drop(columns=['index'])
        all_dfs.append(df)

# 合并为一个总表
all_data = pd.concat(all_dfs, ignore_index=True)

# 数据清洗和预处理
df = all_data.dropna(subset=['student_ID'])
df = df[df['time'] > 0]

df['score'] = df['score'].fillna(0)
df.loc[df['state'] == 'Absolutely_Correct', 'score'] = 3
df['memory'] = df['memory'].fillna(0)

# 确保timeconsume列是数值类型
df['timeconsume'] = pd.to_numeric(df['timeconsume'], errors='coerce').fillna(0)

# 编码答题状态
le = LabelEncoder()
df['state_encoded'] = le.fit_transform(df['state'])
from sklearn.preprocessing import LabelEncoder

le = LabelEncoder()
df['state_encoded'] = le.fit_transform(df['state'])

# 查看编码对应关系
print(dict(zip(le.classes_, le.transform(le.classes_))))

# 提取时间特征
df['date'] = pd.to_datetime(df['time'], unit='s').dt.date
df['hour'] = pd.to_datetime(df['time'], unit='s').dt.hour

# 计算特征
df['score_bonus'] = df['score']
df['tc_bonus'] = 1 / (df['timeconsume'] + 1)  # 防止除零
df['mem_bonus'] = 1 / (df['memory'] + 1)  # 防止除零
df['_error_type_penalty'] = len(df['state'].unique()) - df['state_encoded']
df['_test_num_penalty'] = df.groupby('student_ID')['state'].transform('size') - df['state_encoded']
df['rank_bonus'] = df.groupby('title_ID')['score'].rank(pct='all', method='min')

student_features = df.groupby('student_ID').agg({
    'score_bonus': 'mean',
    'tc_bonus': 'mean',
    'mem_bonus': 'mean',
    '_error_type_penalty': 'mean',
    '_test_num_penalty': 'mean',
    'rank_bonus': 'mean',
}).reset_index()
features = ['score_bonus', 'tc_bonus', 'mem_bonus', '_error_type_penalty', '_test_num_penalty', 'rank_bonus']
# 特征归一化
scaler = MinMaxScaler()
#features = ['score_bonus', 'tc_bonus', 'mem_bonus', '_error_type_penalty', '_test_num_penalty', 'rank_bonus']
X_scaled= scaler.fit_transform(student_features[features])

kmeans = KMeans(n_clusters=3, random_state=42)
student_features['cluster']= kmeans.fit_predict(X_scaled)
from sklearn.decomposition import PCA

pca = PCA(n_components=2)
X_pca = pca.fit_transform(X_scaled)
student_features['x'] = X_pca[:, 0]
student_features['y'] = X_pca[:, 1]
plt.scatter(student_features['x'], student_features['y'], c=student_features['cluster'], cmap='viridis')
plt.title('Cluster Visualization (PCA)')
plt.xlabel('PC1')
plt.ylabel('PC2')
plt.show()

silhouette_scores = []
for i in range(2, 11):  # 轮廓系数计算需要至少2个聚类
    kmeans = KMeans(n_clusters=i, random_state=42)
    kmeans.fit(X_scaled)
    score = silhouette_score(X_scaled, kmeans.labels_)
    silhouette_scores.append(score)
plt.plot(range(2, 11), silhouette_scores)
plt.title('Silhouette Score For Optimal k')
plt.xlabel('Number of clusters')
plt.ylabel('Silhouette Score')
plt.show()
