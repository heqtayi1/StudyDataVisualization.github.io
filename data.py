# ✅ 完整修复版 data.py（无报错，输出全部图表所需数据）
# 包含修复：类型转换、groupby警告、雷达图字段KeyError、NameError, try-except语法, concat列名问题
# 新增修复：对齐KMeans.py预处理、对齐consecutive_days计算、聚类标签重映射以匹配目标图
# 本次修改：调整consecutive_days计算，重点修复分数分箱逻辑，修复 concat 列名问题

import pandas as pd
import numpy as np  # 虽然linter提示未使用，但Pandas依赖它，保留通常是安全的
import os
import json
from sklearn.preprocessing import StandardScaler  # MinMaxScaler linter提示未使用，如果确实不用可以移除
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA

# === 尝试缓解 KMeans MKL 内存泄漏警告 ===
try:
    if 'OMP_NUM_THREADS' not in os.environ:
        os.environ['OMP_NUM_THREADS'] = '1'  # 保守值
        # print(f"Set OMP_NUM_THREADS to 1 to potentially mitigate KMeans MKL memory leak on Windows.")
except Exception:
    pass  # 忽略设置失败

# === 路径设置 ===
project_root = 'D:/pyproject/Chinavis'  # 请确保此路径正确
data_dir = os.path.join(project_root, 'data')
submit_dir = os.path.join(data_dir, 'Data_SubmitRecord')
title_path = os.path.join(data_dir, 'Data_TitleInfo.csv')
output_dir = os.path.join(project_root, 'output_json')
os.makedirs(output_dir, exist_ok=True)

# === 数据读取与预处理 ===
all_files = [os.path.join(submit_dir, f) for f in os.listdir(submit_dir) if f.endswith('.csv')]
df = pd.concat([pd.read_csv(f) for f in all_files], ignore_index=True)

# --- 对齐KMeans.py的预处理步骤 ---
if 'Unnamed: 0' in df.columns:
    df = df.drop(columns=['Unnamed: 0'])
if 'index' in df.columns and df['index'].equals(pd.RangeIndex(start=0, stop=len(df))):
    df = df.drop(columns=['index'])

# Class filtering
if 'class' in df.columns:
    valid_classes = [f'Class{i}' for i in range(1, 15)]
    df = df[df['class'].isin(valid_classes)]
else:
    print("Warning: 'class' column not found for filtering. Skipping class-based filtering.")

# 时间解析
df['time'] = pd.to_numeric(df['time'], errors='coerce')
df['date'] = pd.to_datetime(df['time'], unit='s', errors='coerce').dt.normalize()  # 使用 normalize 获取日期部分
df['weekday'] = df['date'].dt.weekday  # 直接从 normalize 后的 date 获取 weekday
df['hour'] = pd.to_datetime(df['time'], unit='s', errors='coerce').dt.hour

# 数值类型转换
df['score'] = pd.to_numeric(df['score'], errors='coerce')
df['timeconsume'] = pd.to_numeric(df['timeconsume'], errors='coerce')
df['memory'] = pd.to_numeric(df['memory'], errors='coerce')

# 丢弃非法记录
df = df.dropna(subset=['student_ID', 'title_ID', 'time', 'score', 'timeconsume', 'memory', 'date', 'weekday', 'hour'])

# === 构造五个标准聚类特征 ===
# 1. 总答题次数
answer_times = df.groupby('student_ID').size().rename('answer_times')

# 2. 尝试的唯一题目数量
unique_questions_attempted = df.groupby('student_ID')['title_ID'].nunique()  # .name is 'title_ID'

# 3. 平均每道唯一题目的尝试次数
avg_attempts_per_unique_question = (answer_times / unique_questions_attempted).rename(
    'avg_attempts_per_unique_question')

# 4. 活跃天数
active_days = df.groupby('student_ID')['date'].nunique()  # .name is 'date'


# 5. 最大连续答题天数
def calculate_max_consecutive_days(dates_series: pd.Series) -> int:
    if dates_series.empty: return 0
    dates = dates_series.drop_duplicates().sort_values()
    if len(dates) <= 1: return len(dates)
    diffs = dates.diff().dt.days
    is_consecutive = (diffs == 1)
    max_streak, current_streak = 0, 0
    for streak_val in is_consecutive:  # 第一个 diffs[0] 是 NaT, is_consecutive[0] 是 False
        if streak_val:
            current_streak += 1
        else:
            max_streak = max(max_streak, current_streak); current_streak = 0
    max_streak = max(max_streak, current_streak)
    return max_streak + 1 if max_streak > 0 else (1 if len(dates) > 0 else 0)


consecutive_days = df.groupby('student_ID')['date'].apply(calculate_max_consecutive_days).rename('consecutive_days')

# 6. 答对的唯一题目数 (额外特征，但也常用于聚类)
unique_correct_questions = (df[df['state'] == 'Absolutely_Correct']
                            .drop_duplicates(['student_ID', 'title_ID'])
                            .groupby('student_ID').size().rename('unique_correct_questions'))

# *** 关键修改位置：确保 Series 的 name 属性是你期望的列名 ***
active_days.name = 'active_days'
unique_questions_attempted.name = 'unique_questions_attempted'
# 其他 Series (avg_attempts_per_unique_question, unique_correct_questions, consecutive_days)
# 在定义时已经通过 .rename() 设置了正确的 name 属性。

# 打印检查 name 是否已正确设置
print(f"\n--- 检查 Series names before concat ---")
print(f"active_days.name: {active_days.name}")
print(f"unique_questions_attempted.name: {unique_questions_attempted.name}")
print(f"avg_attempts_per_unique_question.name: {avg_attempts_per_unique_question.name}")
print(f"unique_correct_questions.name: {unique_correct_questions.name}")
print(f"consecutive_days.name: {consecutive_days.name}\n")

# 合并所有基础特征
features_base = pd.concat([
    active_days,  # 直接使用已设置好 name 的 Series
    unique_questions_attempted,  # 直接使用已设置好 name 的 Series
    avg_attempts_per_unique_question,
    unique_correct_questions,
    consecutive_days
], axis=1).fillna(0)

# 打印 features_base 的列名和信息以供调试
print("\n--- features_base 列名 (修改后) ---")
print(features_base.columns)
print("\n--- features_base 信息 (修改后) ---")
features_base.info()
print("\n--- 再次检查 features_base 中是否存在 active_days 和 unique_questions_attempted (修改后) ---")
print(f"features_base 中是否存在 'active_days': {'active_days' in features_base.columns}")
print(f"features_base 中是否存在 'unique_questions_attempted': {'unique_questions_attempted' in features_base.columns}")

# === 标准化并聚类 ===
scaler = StandardScaler()
X_scaled = scaler.fit_transform(features_base)  # 使用 features_base 进行标准化
kmeans = KMeans(n_clusters=3, random_state=42, n_init='auto')
features_base['cluster_orig'] = kmeans.fit_predict(X_scaled)  # 将原始聚类标签添加到 features_base

# === PCA 降维可视化 ===
pca = PCA(n_components=2)
pca_result = pca.fit_transform(X_scaled)  # 对已标准化的数据进行PCA
features_base['PC1'] = pca_result[:, 0]  # 添加PC1到 features_base
features_base['PC2'] = pca_result[:, 1]  # 添加PC2到 features_base

# === 聚类标签重映射 ===
cl_centroids_pca = features_base.groupby('cluster_orig')[['PC1', 'PC2']].mean()
orig_lbl_mode2 = cl_centroids_pca['PC1'].idxmax()
rem_lbls_01 = [l for l in cl_centroids_pca.index if l != orig_lbl_mode2]
# 安全检查，如果 rem_lbls_01 不足两个元素
if len(rem_lbls_01) < 2:
    print(f"警告: 剩余标签不足2个 ({len(rem_lbls_01)}个)，PCA映射可能不准确。")
    # 提供一个回退机制，例如默认分配或基于其他逻辑
    if len(rem_lbls_01) == 1:
        orig_lbl_mode0 = rem_lbls_01[0]
        orig_lbl_mode1 = rem_lbls_01[0]  # 或者一些默认值
    else:  # 0个剩余标签，非常罕见
        orig_lbl_mode0 = orig_lbl_mode2  # 极端回退
        orig_lbl_mode1 = orig_lbl_mode2
else:
    orig_lbl_mode0 = cl_centroids_pca.loc[rem_lbls_01, 'PC2'].idxmin()
    orig_lbl_mode1 = [l for l in rem_lbls_01 if l != orig_lbl_mode0][0]

label_map = {orig_lbl_mode0: 0, orig_lbl_mode1: 1, orig_lbl_mode2: 2}  # 黄, 绿, 蓝
features_base['cluster'] = features_base['cluster_orig'].map(label_map)  # 添加最终聚类标签到 features_base

# === 添加总提交次数到 features_base 以便散点图使用 ===
# 确保 answer_times 的索引与 features_base 的索引 (student_ID) 一致
features_base['total_submissions'] = answer_times.reindex(features_base.index).fillna(0)

# === 散点图数据 ===
scatter_data = [
    {'x': r['PC1'], 'y': r['PC2'], 'size': max(1, r['total_submissions']), 'category': f"模式{int(r['cluster'])}"} for
    _, r in features_base.iterrows()]
with open(os.path.join(output_dir, 'scatter_cluster_data.json'), 'w', encoding='utf-8') as f: json.dump(scatter_data, f,
                                                                                                        ensure_ascii=False,
                                                                                                        indent=2)

# === 热力图数据 ===
wd_map = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
hm_arr = df.groupby(['weekday', 'hour'], observed=False).size().unstack(fill_value=0).reindex(index=range(7),
                                                                                              columns=range(24),
                                                                                              fill_value=0)
hm_data = [[wd_map[i], h, int(hm_arr.loc[i, h])] for i in hm_arr.index for h in hm_arr.columns]
with open(os.path.join(output_dir, 'heatmap_peak_time_data.json'), 'w', encoding='utf-8') as f: json.dump(hm_data, f,
                                                                                                          ensure_ascii=False,
                                                                                                          indent=2)

# === 雷达图、平行坐标图等额外特征 ===
grp = df.groupby('student_ID')
extra_feats = pd.DataFrame({
    'avg_score': grp['score'].mean(),
    'avg_timeconsume_ms': grp['timeconsume'].mean(),
    'avg_memory_kb': grp['memory'].mean(),
    'submission_hour_std': grp['hour'].std()
})
features_full = features_base.join(extra_feats).fillna(0)  # 合并基础特征和额外特征

# 打印 features_full 的列名和信息以供最终调试
print("\n--- features_full 列名 (最终) ---")
print(features_full.columns)
print("\n--- features_full 信息 (最终) ---")
features_full.info()

# 定义雷达图的特征组
radar_groups = {
    '强度投入': ['active_days', 'consecutive_days', 'avg_attempts_per_unique_question', 'unique_questions_attempted',
             'total_submissions'],
    '质量效率': ['avg_score', 'avg_timeconsume_ms', 'avg_memory_kb', 'submission_hour_std'],
    '答题习惯': ['unique_correct_questions', 'avg_attempts_per_unique_question', 'consecutive_days']}

# 检查雷达图所需的核心特征是否都存在于 features_full 中
req_cols_radar = set(k for kl in radar_groups.values() for k in kl)
miss_cols = req_cols_radar - set(features_full.columns)
if miss_cols:
    raise KeyError(f"雷达图核心特征缺失: {miss_cols}. features_full的列是: {features_full.columns.tolist()}")

# === 雷达图数据导出 ===
radar_export = {}
print("\n--- 雷达图原始平均值 (归一化前) ---")
for name, keys in radar_groups.items():
    data_radar = features_full.groupby('cluster')[keys].mean().sort_index()
    print(f"\n雷达图组: {name}\n{data_radar}")
    scaled_data_radar = data_radar.copy()
    if not data_radar.empty:
        all_const = True
        for col in data_radar.columns:
            c_min, c_max = data_radar[col].min(), data_radar[col].max()
            if abs(c_max - c_min) < 1e-9:  # 检查浮点数是否相等
                scaled_data_radar[col] = 0.5
            else:
                all_const = False;
                scaled_data_radar[col] = (data_radar[col] - c_min) / (c_max - c_min)
        if all_const and len(data_radar) > 1: print(f"警告: 雷达图组'{name}'特征在各模式间值相同")
    else:
        scaled_data_radar = pd.DataFrame(columns=keys)
    radar_export[name] = {'indicator': [{'name': k, 'max': 1.0} for k in keys],
                          'series_data': [{'name': f"模式{idx}", 'value': row.tolist()} for idx, row in
                                          scaled_data_radar.iterrows()]}
print("--- 结束雷达图原始平均值打印 ---\n")
with open(os.path.join(output_dir, 'radar_all_profile_data.json'), 'w', encoding='utf-8') as f: json.dump(radar_export,
                                                                                                          f,
                                                                                                          ensure_ascii=False,
                                                                                                          indent=2)

# === 平行坐标图数据 ===
str_keys = radar_groups.get('强度投入', [])
par_data_list = [features_full[features_full.cluster == i][str_keys].mean().tolist() for i in range(kmeans.n_clusters)]
parallel = {'strength': {'names': str_keys, 'data': par_data_list}}
with open(os.path.join(output_dir, 'parallel_profile_data.json'), 'w', encoding='utf-8') as f: json.dump(parallel, f,
                                                                                                         ensure_ascii=False,
                                                                                                         indent=2)

# === 聚类样本量柱状图 ===
bar_profile = [{'pattern': f"模式{i}", 'count': int((features_base['cluster'] == i).sum())} for i in
               range(kmeans.n_clusters)]
with open(os.path.join(output_dir, 'bar_profile_data.json'), 'w', encoding='utf-8') as f: json.dump(bar_profile, f,
                                                                                                    ensure_ascii=False,
                                                                                                    indent=2)

# === 分数分箱与桑基图/旭日图数据准备 ===
titles_df = pd.read_csv(title_path)
score_group = df.groupby('student_ID')['score'].mean()
score_group = score_group.reindex(features_base.index).fillna(
    score_group.median() if not score_group.empty else 0.0)  # 填充0.0 如果中位数也是NaN

print("\n--- 原始 score_group 描述性统计 (分箱前) ---")
print(score_group.describe())
print("--- 结束原始 score_group 描述性统计 ---\n")

score_bin_labels_default = ['低分段', '中分段', '高分段']
try:
    score_bin = pd.qcut(score_group, q=3, labels=score_bin_labels_default, duplicates='drop')
    if len(score_bin.cat.categories) < len(score_bin_labels_default):
        print(f"警告: pd.qcut 原计划分 {len(score_bin_labels_default)} 组，实际因数据集中只分出 {len(score_bin.cat.categories)} 组。")
        if len(score_bin.cat.categories) == 2:
            score_bin_labels_actual = ['较低分组', '较高分组']
        elif len(score_bin.cat.categories) == 1:
            score_bin_labels_actual = ['整体组']
        else:
            score_bin_labels_actual = [f"分组{i + 1}" for i in range(len(score_bin.cat.categories))]  # 通用标签

        # 重新用实际产生的bins进行cut，或者直接用qcut产生的数字标签然后映射
        # 为了确保labels和分段数一致，这里重新用减少的q值进行qcut
        actual_q = len(score_bin.cat.categories)
        if actual_q > 0:
            score_bin = pd.qcut(score_group, q=actual_q, labels=score_bin_labels_actual[:actual_q], duplicates='drop')
        else:  # 极端情况，无法分箱
            score_bin = pd.Series(['整体组'] * len(score_group), index=score_group.index, dtype='category')
    print(f"使用 pd.qcut 分为 {len(score_bin.cat.categories)} 个分数段。")
except ValueError as e_qcut:  # Corrected variable name for exception
    print(f"pd.qcut 分箱失败: {e_qcut}。")
    print("将尝试使用基于描述性统计的固定阈值分箱作为备选。")
    min_s, q1_s, q2_s, max_s = score_group.min(), score_group.quantile(0.33), score_group.quantile(
        0.66), score_group.max()
    bins_fb = sorted(list(set([min_s, q1_s, q2_s, max_s])))
    unique_b = [bins_fb[0]] if bins_fb else []
    for b_val_idx in range(1, len(bins_fb)):
        if bins_fb[b_val_idx] > unique_b[-1] + 1e-9: unique_b.append(bins_fb[b_val_idx])
    final_b, labels_fb = ([score_group.min() - 0.01, score_group.max() + 0.01], ['整体分段'])  # Default
    if len(unique_b) >= 4:
        final_b, labels_fb = [unique_b[0] - 0.01, unique_b[1], unique_b[-2], unique_b[-1] + 0.01], ['低分段', '中分段', '高分段']
    elif len(unique_b) == 3:
        final_b, labels_fb = [unique_b[0] - 0.01, unique_b[1], unique_b[2] + 0.01], ['较低分段', '较高分段']
    elif len(unique_b) == 2:
        final_b = [unique_b[0] - 0.01, unique_b[1] + 0.01]  # labels_fb 保持 ['整体分段']

    # 再次精炼bins，确保它们是严格递增的
    refined_bins = [final_b[0]]
    for b_check_idx in range(1, len(final_b)):
        if final_b[b_check_idx] > refined_bins[-1] + 1e-9:
            refined_bins.append(final_b[b_check_idx])
    final_b = refined_bins

    # 根据最终bins数量调整labels
    if len(final_b) - 1 != len(labels_fb):
        if len(final_b) == 2:
            labels_fb = ['整体分段']
        elif len(final_b) == 3:
            labels_fb = ['较低分段', '较高分段']
        # 如果final_bins数量和期望的labels不符，可能需要更复杂的逻辑或接受默认
        # 这里，如果不能精确匹配3个label，就用上面根据bins数量调整的label

    print(f"备选分箱阈值: {final_b}, 备选分箱标签: {labels_fb}")
    if len(final_b) >= 2 and len(labels_fb) == len(final_b) - 1:
        score_bin = pd.cut(score_group, bins=final_b, labels=labels_fb, right=False, include_lowest=True,
                           duplicates='drop')
    else:
        print("警告：备选分箱逻辑也未能有效分出多组，所有学生归为'整体分段'")
        score_bin = pd.Series(['整体分段'] * len(score_group), index=score_group.index, dtype='category')

print("\n--- 新的分数段分布 (调整后) ---")
print("score_bin 各类别数量:\n", score_bin.value_counts())
print("\nscore_bin 各类别百分比:\n", score_bin.value_counts(normalize=True))
print("--- 结束新的分数段分布 ---\n")

sankey_df_prep = pd.DataFrame({'student_ID': score_bin.index, 'score_level': score_bin.values})
sankey_df_prep = sankey_df_prep.merge(features_base[['cluster']].reset_index(), on='student_ID', how='left')
sankey_df_prep = sankey_df_prep.rename(columns={'cluster': 'cluster_mapped'})
pref_df = df.groupby(['student_ID', 'title_ID'], observed=False).size().reset_index(name='cnt').sort_values('cnt',
                                                                                                            ascending=False).drop_duplicates(
    'student_ID')
pref_df = pref_df.merge(titles_df[['title_ID', 'knowledge']], on='title_ID', how='left')
sankey_df_final = sankey_df_prep.merge(pref_df[['student_ID', 'knowledge']], on='student_ID', how='left')
sankey_df_final = sankey_df_final.dropna(subset=['cluster_mapped', 'score_level', 'knowledge'])

sankey_links_raw = []
for _, r_sankey in sankey_df_final.iterrows():
    sankey_links_raw.append(
        {'source': f"模式{int(r_sankey['cluster_mapped'])}", 'target': str(r_sankey['score_level']), 'value': 1})
    sankey_links_raw.append({'source': str(r_sankey['score_level']), 'target': str(r_sankey['knowledge']), 'value': 1})
sankey_links_agg = {}
for l_sankey in sankey_links_raw: k_sankey = (l_sankey['source'], l_sankey['target']); sankey_links_agg[
    k_sankey] = sankey_links_agg.get(k_sankey, 0) + l_sankey['value']
sankey_links = [{'source': s, 'target': t, 'value': v} for (s, t), v in sankey_links_agg.items()]
all_nodes_sankey = list(set(l_s['source'] for l_s in sankey_links).union(set(l_t['target'] for l_t in sankey_links)))
sankey_data = {'nodes': [{'name': n_sankey} for n_sankey in all_nodes_sankey], 'links': sankey_links}
with open(os.path.join(output_dir, 'sankey_pattern_score_qtype.json'), 'w', encoding='utf-8') as f: json.dump(
    sankey_data, f, ensure_ascii=False, indent=2)
print("桑基图数据导出成功。")

# === III/IV 板块数据导出 ===
df_merged_titles = df.merge(titles_df[['title_ID', 'knowledge']], on='title_ID', how='left').merge(
    features_base[['cluster']].reset_index(), on='student_ID', how='left').dropna(subset=['knowledge', 'cluster'])
df_merged_titles['cluster'] = df_merged_titles['cluster'].astype(int)
knowledge_scores = df_merged_titles.groupby(['cluster', 'knowledge'], observed=False)['score'].mean().unstack().fillna(
    0)
knowledge_counts = df_merged_titles.groupby('knowledge', observed=False).size().sort_values(ascending=False)
top_n_knowledge = knowledge_counts.head(15).index
knowledge_scores_top_n = knowledge_scores.reindex(columns=top_n_knowledge, fill_value=0.0)
hm_knowledge_data = {"knowledge_points": knowledge_scores_top_n.columns.tolist(),
                     "modes": [f"模式{i}" for i in knowledge_scores_top_n.index.tolist()], "data": []}
for mi, ml in enumerate(hm_knowledge_data["modes"]):
    for ki, kl in enumerate(hm_knowledge_data["knowledge_points"]):
        score_val = knowledge_scores_top_n.iloc[mi, ki];
        hm_knowledge_data["data"].append([ki, mi, round(score_val, 2) if pd.notnull(score_val) else 0.0])
with open(os.path.join(output_dir, 'knowledge_mastery_heatmap_data.json'), 'w', encoding='utf-8') as f: json.dump(
    hm_knowledge_data, f, ensure_ascii=False, indent=2)
print("知识点掌握度热图数据导出成功。")

# === III/IV - 知识点序列通过率漏斗图数据 ===
knowledge_sequence = knowledge_counts.head(4).index.tolist()
knowledge_funnel_data_echarts = []
if len(knowledge_sequence) < 2:
    print("警告: 知识点序列过短，漏斗图数据为空。")
else:
    print(f"用于漏斗图的知识点序列: {knowledge_sequence}")
    funnel_data_list = []
    student_max_scores_kn = df_merged_titles.groupby(['student_ID', 'knowledge'], observed=False)[
        'score'].max().unstack()

    # *** 核心修改：调整漏斗图的通过标准 ***
    # 由于整体分数偏低，我们将通过标准设为高于该知识点在该模式下学生得分的中位数
    # 或者一个固定的较低阈值，例如 score > 1.0 (根据你的score_group分布调整)
    # 这里我们使用一个示例固定阈值，你需要根据你的数据调整
    PASS_THRESHOLD = score_group.quantile(0.6)  # 例如，高于60%分位数的算通过
    print(f"漏斗图通过分数阈值设置为: {PASS_THRESHOLD:.2f}")

    for mode_cid in sorted(features_base['cluster'].unique()):
        stud_in_mode = features_base[features_base['cluster'] == mode_cid].index
        # 获取该模式下学生在选定知识点上的最高分
        mode_scores_sq = student_max_scores_kn.reindex(index=stud_in_mode, columns=knowledge_sequence).fillna(
            0)  # fillna确保列存在

        if not len(stud_in_mode): continue  # 如果该模式没有学生，则跳过

        # 漏斗图数据结构：从模式总人数开始，逐步筛选
        # 第一层是模式总人数
        # funnel_data_list.append({'mode':f"模式{int(mode_cid)}",'knowledge': '模式总人数', 'value':int(len(stud_in_mode))})

        # 后续是每个知识点的通过人数
        # 为了漏斗效果，通常后续阶段人数少于或等于前一阶段
        # 这里我们计算的是每个知识点独立通过的人数（相对于模式总人数）
        # 如果需要严格的路径通过率，逻辑会更复杂

        for i, kn_sq_item in enumerate(knowledge_sequence):
            passed_c_funnel = 0
            if kn_sq_item in mode_scores_sq.columns and not mode_scores_sq[kn_sq_item].empty:
                # 使用新的通过阈值
                passed_c_funnel = mode_scores_sq[kn_sq_item][mode_scores_sq[kn_sq_item] >= PASS_THRESHOLD].count()

            funnel_data_list.append({
                'mode': f"模式{int(mode_cid)}",
                'knowledge': str(kn_sq_item),  # 阶段名称
                'value': int(passed_c_funnel)  # 该阶段的人数
            })

    temp_funnel_d = {}
    for item_fnl in funnel_data_list:
        if item_fnl['mode'] not in temp_funnel_d: temp_funnel_d[item_fnl['mode']] = []
        # 确保value非负
        current_value = item_fnl['value'] if item_fnl['value'] >= 0 else 0
        temp_funnel_d[item_fnl['mode']].append({'value': current_value, 'name': item_fnl['knowledge']})

    # 为ECharts漏斗图系列动态分配位置和宽度
    num_fnls_act = len(temp_funnel_d);
    base_l, total_w, gap_p = 3, 90, 2  # 调整gap
    fnl_w_p = (total_w - (num_fnls_act - 1) * gap_p) / num_fnls_act if num_fnls_act > 0 else 28  # 调整默认宽度
    if fnl_w_p <= 0 or num_fnls_act == 0: fnl_w_p = 28

    curr_l_fnl = base_l;
    sorted_m_fnl = sorted(temp_funnel_d.keys(), key=lambda x: int(x.replace("模式", "")))
    for mn_fnl in sorted_m_fnl:
        dp_fnl = temp_funnel_d[mn_fnl]
        # 确保数据点按知识点序列的顺序排列 (如果需要严格的漏斗顺序)
        # dp_fnl.sort(key=lambda x: knowledge_sequence.index(x['name']) if x['name'] in knowledge_sequence else float('inf'))

        knowledge_funnel_data_echarts.append({
            'name': mn_fnl,
            'type': 'funnel',
            'left': f'{curr_l_fnl}%',
            'width': f'{fnl_w_p}%',
            'top': '12%',  # 稍微往下调整
            'bottom': '12%',
            'minSize': '0%',
            'maxSize': '100%',
            'sort': 'none',  # 改为 'none' 或 'ascending'，如果数据本身不是严格递减的
            # 或者在data.py中确保数据是递减的（严格漏斗）
            # 这里我们假设数据是按阶段独立计算的，不一定递减，所以用 'none'
            'gap': gap_p,
            'funnelAlign': 'center',
            'label': {'show': True, 'position': 'inside', 'formatter': '{b}\n{c}人', 'color': '#fff', 'fontSize': 9,
                      'fontWeight': 'bold'},
            'labelLine': {'show': False},
            'itemStyle': {'borderColor': '#fff', 'borderWidth': 1},
            'data': dp_fnl
        })
        curr_l_fnl += fnl_w_p + gap_p
with open(os.path.join(output_dir, 'knowledge_funnel_data.json'), 'w', encoding='utf-8') as f: json.dump(
    knowledge_funnel_data_echarts, f, ensure_ascii=False, indent=2)
print("知识点序列通过率漏斗图数据导出成功。")

sunburst_data_final = []
if 'sankey_df_final' not in locals() or sankey_df_final.empty:
    print("警告: sankey_df_final 未定义或为空，旭日图数据为空。")
else:
    sunburst_grouped = sankey_df_final.groupby(['cluster_mapped', 'score_level', 'knowledge'],
                                               observed=False).size().reset_index(name='value')
    for mode_v_sb, mode_df_sb in sunburst_grouped.groupby('cluster_mapped', observed=False):
        mode_n_sb = {"name": f"模式{int(mode_v_sb)}", "children": []}
        for score_l_v_sb, score_df_sb in mode_df_sb.groupby('score_level', observed=False):
            score_n_sb = {"name": str(score_l_v_sb), "children": []}
            top_k_kn_sb = score_df_sb.nlargest(5, 'value')
            for _, r_kn_sb in top_k_kn_sb.iterrows(): score_n_sb["children"].append(
                {"name": str(r_kn_sb['knowledge']), "value": int(r_kn_sb['value'])})
            if score_n_sb["children"]: mode_n_sb["children"].append(score_n_sb)
        if mode_n_sb["children"]: sunburst_data_final.append(mode_n_sb)
with open(os.path.join(output_dir, 'sunburst_preference_data.json'), 'w', encoding='utf-8') as f: json.dump(
    sunburst_data_final, f, ensure_ascii=False, indent=2)
print("旭日图偏好数据导出成功。")

# === III/IV - 替换为径向柱状图 (玉玦图) 数据 ===
# knowledge_sequence 和 PASS_THRESHOLD 保持之前的定义和计算
# ... ( PASS_THRESHOLD = score_group.quantile(0.6) ... )

radial_bar_data_final = []  # 用于存储最终给ECharts的数据
mode_total_students = features_base.groupby('cluster').size()
if len(knowledge_sequence) < 1:  # 至少需要一个知识点
    print("警告: 知识点序列为空，无法生成径向柱状图。")
else:
    print(f"用于径向柱状图的知识点序列: {knowledge_sequence}")
    student_max_scores_kn = df_merged_titles.groupby(['student_ID', 'knowledge'], observed=False)[
        'score'].max().unstack()

    # 外层是模式，内层是知识点
    radial_data_temp = []  # [{name: '模式0-知识点A', value: 10}, ...]

    for mode_cid in sorted(features_base['cluster'].unique()):
        stud_in_mode = features_base[features_base['cluster'] == mode_cid].index
        mode_scores_sq = student_max_scores_kn.reindex(index=stud_in_mode, columns=knowledge_sequence).fillna(0)
        if not len(stud_in_mode): continue

        for kn_sq_item in knowledge_sequence:
            passed_c_radial = 0
            if kn_sq_item in mode_scores_sq.columns and not mode_scores_sq[kn_sq_item].empty:
                passed_c_radial = mode_scores_sq[kn_sq_item][mode_scores_sq[kn_sq_item] >= PASS_THRESHOLD].count()
                total_in_mode = mode_total_students.get(mode_cid, 1)  # 避免除以0
                pass_percentage = (passed_c_radial / total_in_mode) * 100 if total_in_mode > 0 else 0
            # 为每个数据点赋予模式和知识点的组合名称
            radial_data_temp.append({
                                        'name': f"{str(kn_sq_item)}\n(模式{int(mode_cid)})",
                                        'value': round(pass_percentage, 1), # 使用百分比，保留一位小数
            'actual_count': int(passed_c_radial), # 额外保存实际人数，用于tooltip
            'mode_id': int(mode_cid)
            })

    # 可以选择是否过滤掉value为0的数据点，或者在ECharts中处理
    radial_bar_data_final = [item for item in radial_data_temp if item['value'] > 0]  # 只保留有通过人数的

with open(os.path.join(output_dir, 'radial_bar_knowledge_data.json'), 'w', encoding='utf-8') as f:
    json.dump(radial_bar_data_final, f, ensure_ascii=False, indent=2)
print("径向柱状图（玉玦图）数据导出成功。")

# === III/IV - 新增：河流图数据 - 模式在知识点序列上的进展 ===
# knowledge_sequence 和 PASS_THRESHOLD 保持之前的定义和计算
# ... ( PASS_THRESHOLD = score_group.quantile(0.6) ... )

theme_river_data = []
if len(knowledge_sequence) < 1:
    print("警告: 知识点序列为空，无法生成河流图。")
else:
    student_max_scores_kn_river = df_merged_titles.groupby(['student_ID', 'knowledge'], observed=False)[
        'score'].max().unstack()

    # 遍历知识点序列作为“时间轴”
    for kn_idx, kn_item_river in enumerate(knowledge_sequence):
        # 遍历每个模式
        for mode_cid_river in sorted(features_base['cluster'].unique()):
            stud_in_mode_river = features_base[features_base['cluster'] == mode_cid_river].index
            mode_scores_sq_river = student_max_scores_kn_river.reindex(index=stud_in_mode_river,
                                                                       columns=[kn_item_river]).fillna(0)

            if not len(stud_in_mode_river):
                count_at_stage = 0
            else:
                count_at_stage = 0
                if kn_item_river in mode_scores_sq_river.columns and not mode_scores_sq_river[kn_item_river].empty:
                    count_at_stage = mode_scores_sq_river[kn_item_river][
                        mode_scores_sq_river[kn_item_river] >= PASS_THRESHOLD].count()

            theme_river_data.append([
                kn_idx,  # '时间点' (知识点序列的索引)
                int(count_at_stage),  # 该模式在该阶段的人数
                f"模式{int(mode_cid_river)}"  # 类别名称
            ])

with open(os.path.join(output_dir, 'theme_river_knowledge_progress_data.json'), 'w', encoding='utf-8') as f:
    json.dump(theme_river_data, f, ensure_ascii=False, indent=2)
print("主题河流图数据导出成功。")

print("✅ 所有图表数据导出成功！")