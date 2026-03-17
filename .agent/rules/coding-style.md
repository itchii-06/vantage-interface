---
trigger: always_on
---

# コーディングスタイル

## 言語・型

- TypeScriptを全パッケージで使用（`any`は原則禁止。やむを得ない場合は`// eslint-disable`コメントで理由を明記）

### コードスタイル

- **Prettier**を全パッケージに適用（設定はルートの`.prettierrc`に従う）
- フォーマットせずにコミットしない
- コミットルールは`.agent/rules/commit-rules.md`を参照

## TypeScript

- 型定義は`types/`パッケージに集約し、重複定義しない
- 型定義は`type`に統一する（`interface`は使わない）
- `any`は禁止。やむを得ない場合は`// eslint-disable`コメントで理由を明記
- 関数はアロー関数に統一する
- Early returnを使い、ネストを深くしない
- マジックナンバーは定数化する

## Reactコンポーネント

- コンポーネントは`function`宣言で定義する（アロー関数は使わない）
- propsの型は`type`で定義する

```typescript
// Good
type ButtonProps = {
  label: string
  onPress: () => void
}

function Button({ label, onPress }: ButtonProps) {
  return <button onClick={onPress}>{label}</button>
}

// Bad
const Button = ({ label, onPress }: ButtonProps) => {
  return <button onClick={onPress}>{label}</button>
}
```

- フック・ユーティリティ関数はアロー関数で定義する（コンポーネントのみfunctionを使う）

```typescript
// Good
export const useDebounce = <T>(value: T, delay: number): T => { ... }

// Good
export const formatDate = (date: Date): string => { ... }
```

## 命名規則

- コンポーネント: PascalCase（例: `UserCard`）
- フック: `use`プレフィックス + camelCase（例: `useDebounce`）
- 定数: UPPER_SNAKE_CASE（例: `MAX_RETRY_COUNT`）
- 関数・変数: camelCase（例: `formatDate`）
- 型: PascalCase（例: `UserType`）
