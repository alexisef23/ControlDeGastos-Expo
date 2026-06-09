import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  useColorScheme,
  TextInputProps,
  TouchableOpacity,
} from 'react-native';
import { Colors, Spacing, BorderRadius } from '../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface CustomInputProps extends TextInputProps {
  label?: string;
  error?: string;
  iconName?: keyof typeof Ionicons.glyphMap;
  isPassword?: boolean;
}

export default function CustomInput({
  label,
  error,
  iconName,
  isPassword = false,
  secureTextEntry,
  style,
  ...props
}: CustomInputProps) {
  const scheme = useColorScheme();
  const themeColors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(!secureTextEntry);

  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>}
      
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: themeColors.backgroundElement,
            borderColor: error
              ? themeColors.danger
              : isFocused
              ? themeColors.accent
              : themeColors.border,
            borderWidth: isFocused || error ? 1.5 : 1,
          },
        ]}
      >
        {iconName && (
          <Ionicons
            name={iconName}
            size={20}
            color={error ? themeColors.danger : themeColors.textSecondary}
            style={styles.icon}
          />
        )}

        <TextInput
          style={[styles.input, { color: themeColors.text }, style]}
          placeholderTextColor={themeColors.textSecondary}
          secureTextEntry={isPassword ? !showPassword : secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            activeOpacity={0.7}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color={themeColors.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={[styles.errorText, { color: themeColors.danger }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.three,
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.half,
  },
  inputContainer: {
    height: 50,
    borderRadius: BorderRadius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
  },
  icon: {
    marginRight: Spacing.one,
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
  },
  eyeIcon: {
    padding: Spacing.one,
  },
  errorText: {
    fontSize: 12,
    marginTop: Spacing.half,
    fontWeight: '500',
  },
});
