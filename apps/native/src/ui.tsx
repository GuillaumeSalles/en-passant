import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

export const colors = {
  background: "#09090b",
  card: "#1e1e20",
  border: "#404045",
  text: "#fafafa",
  muted: "#a1a1aa",
  accent: "#b4d284",
  danger: "#ff9e99",
};
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 14 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  title: { color: colors.text, fontSize: 23, fontWeight: "600" },
  heading: { color: colors.text, fontSize: 18, fontWeight: "600" },
  text: { color: colors.text, fontSize: 15, lineHeight: 22 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  button: {
    minHeight: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 13,
    paddingVertical: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    padding: 12,
    color: colors.text,
    fontSize: 16,
    backgroundColor: colors.background,
  },
  overlay: {
    flex: 1,
    backgroundColor: "#000b",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  dialog: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "90%",
    borderRadius: 12,
    backgroundColor: colors.card,
    padding: 20,
    gap: 16,
  },
});
export function Button({
  children,
  onPress,
  active = false,
  disabled = false,
  label,
}: {
  children: ReactNode;
  onPress(): void;
  active?: boolean;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected: active }}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        active && { backgroundColor: "#3b4830", borderColor: colors.accent },
        disabled && { opacity: 0.4 },
      ]}
    >
      <Text style={styles.text}>{children}</Text>
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  secure = false,
}: {
  label: string;
  value: string;
  onChange(value: string): void;
  multiline?: boolean;
  secure?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.muted}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        secureTextEntry={secure}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.muted}
        style={[styles.input, multiline && { minHeight: 130, textAlignVertical: "top" }]}
      />
    </View>
  );
}
export function Dialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose(): void;
  children: ReactNode;
}) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.overlay}
      >
        <View accessibilityViewIsModal style={styles.dialog}>
          <View style={styles.row}>
            <Text style={[styles.heading, { flex: 1 }]}>{title}</Text>
            <Button onPress={onClose} label="Close dialog">
              Close
            </Button>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
