import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from "react-native";
import { ChevronLeft, Server, User, Lock, Wifi, Save, LogOut, RefreshCw, Shield } from "lucide-react-native";
import { AmbientBackground } from "./AmbientBackground";
import { IptvSettings } from "../utils/settings";

interface Props {
  settings: IptvSettings;
  onSave: (s: IptvSettings) => void;
  onBack: () => void;
  onLogout: () => void;
  liveCount: number;
  movieCount: number;
  seriesCount: number;
  onRefresh: () => void;
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ComponentType<any>;
  placeholder?: string;
  secureTextEntry?: boolean;
  color: string;
}

function Field({ label, value, onChange, icon: Icon, placeholder, secureTextEntry, color }: FieldProps) {
  const [show, setShow] = useState(!secureTextEntry);
  return (
    <View style={fieldStyles.wrapper}>
      <Text style={fieldStyles.label}>{label}</Text>
      <View style={[fieldStyles.row, { borderColor: color + "30" }]}>
        <Icon size={15} color={color} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder || label}
          placeholderTextColor="rgba(255,255,255,0.25)"
          style={fieldStyles.input}
          secureTextEntry={secureTextEntry && !show}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {secureTextEntry && (
          <TouchableOpacity onPress={() => setShow((s) => !s)}>
            <Text style={fieldStyles.showHide}>{show ? "Ocultar" : "Mostrar"}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 10, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  input: { flex: 1, color: "#fff", fontSize: 13 },
  showHide: { fontSize: 10, color: "#a855f7" },
});

export function SettingsScreen({ settings, onSave, onBack, onLogout, liveCount, movieCount, seriesCount, onRefresh }: Props) {
  const [form, setForm] = useState<IptvSettings>(settings);
  const [isDirty, setIsDirty] = useState(false);

  const update = (key: keyof IptvSettings, val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setIsDirty(true);
  };

  const handleSave = () => {
    if (!form.server || !form.username || !form.password) {
      Alert.alert("Erro", "Preencha todos os campos do servidor.");
      return;
    }
    onSave(form);
    setIsDirty(false);
    Alert.alert("Salvo!", "Configurações atualizadas. Recarregue o conteúdo.");
  };

  const handleLogout = () => {
    Alert.alert(
      "Sair",
      "Deseja desconectar e voltar à tela de login?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sair", style: "destructive", onPress: onLogout },
      ]
    );
  };

  const handleRefresh = () => {
    Alert.alert(
      "Recarregar",
      "Deseja recarregar todo o conteúdo do servidor?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Recarregar", onPress: onRefresh },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <TouchableOpacity onPress={onBack} style={styles.backBtn}>
          <ChevronLeft size={20} color="rgba(255,255,255,0.7)" />
          <Text style={styles.backText}>Voltar</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Configurações</Text>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "Canais", count: liveCount, color: "#4ade80" },
            { label: "Filmes", count: movieCount, color: "#fb923c" },
            { label: "Séries", count: seriesCount, color: "#e879f9" },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + "25" }]}>
              <Text style={[styles.statCount, { color: s.color }]}>{s.count.toLocaleString()}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Servidor */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Server size={16} color="#a855f7" />
            <Text style={styles.cardTitle}>Servidor Xtream</Text>
          </View>

          <Field label="URL do Servidor" value={form.server} onChange={(v) => update("server", v)} icon={Wifi} placeholder="http://servidor:porta" color="#a855f7" />
          <Field label="Usuário" value={form.username} onChange={(v) => update("username", v)} icon={User} color="#a855f7" />
          <Field label="Senha" value={form.password} onChange={(v) => update("password", v)} icon={Lock} secureTextEntry color="#a855f7" />

          <TouchableOpacity
            style={[styles.saveBtn, !isDirty && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isDirty}
            activeOpacity={0.8}
          >
            <Save size={15} color={isDirty ? "#fff" : "rgba(255,255,255,0.35)"} />
            <Text style={[styles.saveBtnText, !isDirty && styles.saveBtnTextDisabled]}>Salvar Configurações</Text>
          </TouchableOpacity>
        </View>

        {/* Ações */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Shield size={16} color="#94a3b8" />
            <Text style={styles.cardTitle}>Ações</Text>
          </View>

          <TouchableOpacity style={styles.actionBtn} onPress={handleRefresh} activeOpacity={0.8}>
            <RefreshCw size={15} color="#4ade80" />
            <View style={styles.actionInfo}>
              <Text style={styles.actionTitle}>Recarregar Conteúdo</Text>
              <Text style={styles.actionSub}>Atualiza canais, filmes e séries</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={handleLogout} activeOpacity={0.8}>
            <LogOut size={15} color="#f43f5e" />
            <View style={styles.actionInfo}>
              <Text style={[styles.actionTitle, { color: "#f43f5e" }]}>Desconectar</Text>
              <Text style={styles.actionSub}>Voltar à tela de login</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Versão */}
        <Text style={styles.versionText}>SmartHub Play TV • v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#050308" },
  scroll: {
    padding: 24,
    zIndex: 10,
    maxWidth: 600,
    alignSelf: "center",
    width: "100%",
    minHeight: "100%",
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 20 },
  backText: { fontSize: 13, color: "rgba(255,255,255,0.6)" },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: "#fff", marginBottom: 20 },

  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  statCount: { fontSize: 22, fontWeight: "bold", marginBottom: 4 },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1 },

  card: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  cardTitle: { fontSize: 14, fontWeight: "bold", color: "#fff" },

  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#a855f7",
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: "rgba(168,85,247,0.2)" },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  saveBtnTextDisabled: { color: "rgba(255,255,255,0.35)" },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    marginBottom: 10,
  },
  actionBtnDanger: { borderColor: "rgba(244,63,94,0.2)", backgroundColor: "rgba(244,63,94,0.05)" },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 13, color: "#fff", fontWeight: "600" },
  actionSub: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 },

  versionText: { fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 8 },
});
