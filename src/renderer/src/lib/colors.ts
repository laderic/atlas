export const FOLDER_COLORS = [
  '#e0a96d', '#7fb7a4', '#b58ad6', '#e07a6b', '#6da7e0', '#e0c76d', '#9bd16d', '#d68ab5',
  '#c0392b', '#16a085', '#8e44ad', '#2c3e50', '#f39c12', '#95a5a6'
]
export const tagColor = (i: number): string => FOLDER_COLORS[i % FOLDER_COLORS.length]
