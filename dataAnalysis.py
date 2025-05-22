import pandas as pd

# 1. 读取数据
df = pd.read_csv('first_data\Ⅰ时序多变量教育数据可视分析挑战赛_数据\Data_SubmitRecord\SubmitRecord-Class1.csv')

# 2. 转换时间戳为日期时间
df['datetime'] = pd.to_datetime(df['time'], unit='s')

# 3. 提取日期和小时信息
df['date'] = df['datetime'].dt.date.astype(str)
df['hour'] = df['datetime'].dt.hour

# 按日期统计答题数量
daily_counts = df.groupby('date').size().reset_index(name='count')

# 保存为 daily.json（ECharts 可直接用）
daily_counts.to_json('dailyClass1.json', orient='records')
