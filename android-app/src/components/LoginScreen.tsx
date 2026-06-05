import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Server, User, Lock, Eye, EyeOff, LogIn } from "lucide-react-native";
import { AmbientBackground } from "./AmbientBackground";
import { IptvSettings, normalizeIptvSettings } from "../utils/settings";

interface Props {
  onSubmit: (settings: IptvSettings) => void;
  initial?: Partial<IptvSettings>;
}

export function LoginScreen({ onSubmit, initial }: Props) {
  const [server, setServer] = useState(initial?.server ?? "");
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState(initial?.password ?? "");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!server.trim() || !username.trim() || !password.trim()) {
      setError("Preencha servidor, usuário e senha.");
      return;
    }
    setError(null);
    onSubmit(normalizeIptvSettings({ server, username, password }));
  };

  return (
    <View style={styles.container}>
      {/* Background animado de bolhas */}
      <AmbientBackground />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.splitLayout}>
            {/* Coluna da Esquerda: Logo */}
            <View style={styles.logoColumn}>
              <Image
                source={require("../../assets/logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.subtitle}>Xtream Codes Compatible</Text>
            </View>

            {/* Coluna da Direita: Formulário */}
            <View style={styles.formColumn}>
              <View style={styles.formCard}>
                {/* Input Servidor */}
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Server size={18} color="#a855f7" />
                  </View>
                  <TextInput
                    value={server}
                    onChangeText={setServer}
                    placeholder="Servidor (Ex: http://url:porta)"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Input Usuário */}
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <User size={18} color="#a855f7" />
                  </View>
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Usuário"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                {/* Input Senha */}
                <View style={styles.inputWrapper}>
                  <View style={styles.inputIconContainer}>
                    <Lock size={18} color="#a855f7" />
                  </View>
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Senha"
                    placeholderTextColor="rgba(255, 255, 255, 0.4)"
                    secureTextEntry={!showPwd}
                    style={styles.input}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPwd(!showPwd)}
                    style={styles.eyeBtn}
                    activeOpacity={0.7}
                  >
                    {showPwd ? (
                      <EyeOff size={18} color="rgba(255,255,255,0.6)" />
                    ) : (
                      <Eye size={18} color="rgba(255,255,255,0.6)" />
                    )}
                  </TouchableOpacity>
                </View>

                {error && (
                  <View style={styles.errorBox}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Botão Entrar */}
                <TouchableOpacity
                  onPress={handleSubmit}
                  style={styles.submitBtn}
                  activeOpacity={0.8}
                >
                  <LogIn size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>ENTRAR</Text>
                </TouchableOpacity>

                <Text style={styles.disclaimer}>
                  Dados salvos apenas localmente neste dispositivo.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050308",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  splitLayout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    maxWidth: 860,
  },
  logoColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 24,
  },
  logo: {
    width: 260,
    height: 110,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 10,
    color: "rgba(168, 85, 247, 0.8)",
    textTransform: "uppercase",
    letterSpacing: 3,
    fontWeight: "600",
    textAlign: "center",
  },
  formColumn: {
    flex: 1.2,
    justifyContent: "center",
  },
  formCard: {
    width: "100%",
    backgroundColor: "rgba(20, 10, 36, 0.65)",
    borderWidth: 1,
    borderColor: "rgba(168, 85, 247, 0.25)",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    marginBottom: 12,
    paddingHorizontal: 10,
    height: 46,
  },
  inputIconContainer: {
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    height: "100%",
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
  },
  errorBox: {
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#a855f7",
    borderRadius: 10,
    height: 46,
    gap: 8,
    shadowColor: "#a855f7",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 4,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 1,
  },
  disclaimer: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 10,
    textAlign: "center",
    marginTop: 10,
  },
});
