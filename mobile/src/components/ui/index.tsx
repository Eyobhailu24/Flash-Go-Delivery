import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput,
  View,
  type TextProps,
  type TextInputProps,
  type ViewProps,
} from 'react-native';
import * as CheckboxPrimitive from '@rn-primitives/checkbox';
import { Image } from 'expo-image';
import { cva } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { X, ImageIcon, ChevronDown, Check } from 'lucide-react-native';
import { useLanguage } from '@/lib/i18n';

export const colors = {
  orange: '#f97316',
  ink: '#20232b',
  muted: '#747882',
  background: '#fffaf5',
  line: '#f0e8df',
};
export const cn = (...values: Parameters<typeof clsx>) => twMerge(clsx(values));
export function Txt({
  children,
  style,
  muted,
  bold,
  size = 14,
  ...props
}: TextProps & { muted?: boolean; bold?: boolean; size?: number }) {
  const { t, language } = useLanguage();
  return (
    <NativeText
      {...props}
      style={[
        {
          color: muted ? colors.muted : colors.ink,
          fontSize: size,
          lineHeight: size * 1.45,
          fontFamily:
            language === 'am'
              ? 'NotoSansEthiopic_400Regular'
              : bold
                ? 'Geist_600SemiBold'
                : 'Geist_400Regular',
        },
        style,
      ]}
    >
      {typeof children === 'string' ? t(children) : children}
    </NativeText>
  );
}
const buttonVariants = cva(
  'min-h-12 flex-row items-center justify-center gap-2 rounded-xl px-4 py-3',
  {
    variants: {
      variant: {
        primary: 'bg-primary',
        secondary: 'bg-orange-50',
        ghost: 'bg-transparent',
        danger: 'bg-red-50',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
);
export function Button({
  children,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  className,
  icon,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { t } = useLanguage();
  const color =
    variant === 'primary'
      ? '#fff'
      : variant === 'danger'
        ? '#dc2626'
        : colors.orange;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ? t(accessibilityLabel) : undefined
      }
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant }), className)}
      style={({ pressed }) => ({
        opacity: disabled || loading ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={color} /> : icon}
      <Txt bold style={{ color }}>
        {children}
      </Txt>
    </Pressable>
  );
}
export function IconButton({
  children,
  label,
  onPress,
}: {
  children: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const { t } = useLanguage();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? '#ffedd5' : '#fff7ed',
      })}
    >
      {children}
    </Pressable>
  );
}
export function Checkbox({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useLanguage();
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      accessibilityLabel={t(label)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 48,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: colors.orange,
          backgroundColor: checked ? colors.orange : '#fff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CheckboxPrimitive.Indicator>
          <Check size={17} color="#fff" />
        </CheckboxPrimitive.Indicator>
      </View>
      <Txt>{label}</Txt>
    </CheckboxPrimitive.Root>
  );
}
export function Card({ children, style, ...props }: ViewProps) {
  return (
    <View {...props} style={[styles.card, style]}>
      {children}
    </View>
  );
}
export function Row({ children, style, ...props }: ViewProps) {
  return (
    <View
      {...props}
      style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, style]}
    >
      {children}
    </View>
  );
}
export function Input({
  label,
  style,
  error,
  ...props
}: TextInputProps & { label?: string; error?: string }) {
  const { t, language } = useLanguage();
  return (
    <View style={{ gap: 7, flexShrink: 1 }}>
      {label ? (
        <Txt bold size={13}>
          {label}
        </Txt>
      ) : null}
      <TextInput
        {...props}
        accessibilityLabel={t(label || props.placeholder || 'Input')}
        placeholder={t(props.placeholder || label || '')}
        placeholderTextColor="#93949a"
        style={[
          styles.input,
          {
            fontFamily:
              language === 'am'
                ? 'NotoSansEthiopic_400Regular'
                : 'Geist_400Regular',
          },
          props.multiline && { height: 100, textAlignVertical: 'top' },
          error ? { borderColor: '#ef4444' } : undefined,
          style,
        ]}
      />
      {error ? (
        <Txt style={{ color: '#dc2626' }} size={12}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}
export function Pill({
  children,
  active,
  onPress,
}: {
  children: ReactNode;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: active } : undefined}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 24,
        backgroundColor: active ? colors.orange : '#fff0df',
      }}
    >
      <Txt size={12} bold style={{ color: active ? '#fff' : '#a55318' }}>
        {children}
      </Txt>
    </Pressable>
  );
}
export function Photo({
  uri,
  size,
  style,
}: {
  uri?: string | null;
  size?: number;
  style?: ViewProps['style'];
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size || 145,
          overflow: 'hidden',
          borderRadius: 14,
          backgroundColor: '#fff0df',
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={180}
        />
      ) : (
        <ImageIcon color="#dca26d" size={32} />
      )}
    </View>
  );
}
export function Skeleton({
  height = 20,
  width = '100%',
}: {
  height?: number;
  width?: number | `${number}%`;
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    let active = true;
    const apply = (reduced: boolean) => {
      animation?.stop();
      if (!reduced && active) {
        animation = Animated.loop(
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.9,
              duration: 800,
              useNativeDriver: Platform.OS !== 'web',
            }),
            Animated.timing(opacity, {
              toValue: 0.45,
              duration: 800,
              useNativeDriver: Platform.OS !== 'web',
            }),
          ]),
        );
        animation.start();
      }
    };
    void AccessibilityInfo.isReduceMotionEnabled().then(apply);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      apply,
    );
    return () => {
      active = false;
      animation?.stop();
      subscription.remove();
    };
  }, [opacity]);
  return (
    <Animated.View
      accessible={false}
      style={{
        height,
        width,
        borderRadius: 12,
        backgroundColor: '#fed7aa',
        opacity,
      }}
    />
  );
}
export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ gap: 16 }}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <Skeleton height={105} />
          <Skeleton width="70%" />
          <Skeleton width="45%" />
        </Card>
      ))}
    </View>
  );
}
export function Empty({
  title = 'Nothing here yet',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 34 }}>
      <Txt size={19} bold>
        {title}
      </Txt>
      {description && (
        <Txt muted style={{ textAlign: 'center' }}>
          {description}
        </Txt>
      )}
      {action}
    </Card>
  );
}
export function ErrorState({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <Empty
      title="Something went wrong"
      description={error instanceof Error ? error.message : String(error)}
      action={
        retry ? (
          <Button variant="secondary" onPress={retry}>
            Retry
          </Button>
        ) : undefined
      }
    />
  );
}
export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 15 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt bold size={25} style={{ flexShrink: 1 }}>
          {title}
        </Txt>
        {action}
      </Row>
      {children}
    </View>
  );
}
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#11182766',
            justifyContent: 'flex-end',
          }}
        >
          <Pressable
            accessibilityLabel="Close"
            onPress={onClose}
            style={{ flex: 1 }}
          />
          <View
            accessibilityViewIsModal
            style={{
              maxHeight: '88%',
              backgroundColor: colors.background,
              borderTopLeftRadius: 26,
              borderTopRightRadius: 26,
              padding: 22,
              paddingBottom: 32,
            }}
          >
            <Row style={{ justifyContent: 'space-between', marginBottom: 20 }}>
              <Txt bold size={22}>
                {title}
              </Txt>
              <IconButton label="Close" onPress={onClose}>
                <X size={20} color={colors.ink} />
              </IconButton>
            </Row>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 16, paddingBottom: 24 }}
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      {label && (
        <Txt bold size={13}>
          {label}
        </Txt>
      )}
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={styles.input}
      >
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt>
            {options.find((option) => option.value === value)?.label ||
              'Choose'}
          </Txt>
          <ChevronDown size={18} color={colors.muted} />
        </Row>
      </Pressable>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={label || 'Choose'}
      >
        {options.map((option) => (
          <Button
            key={option.value}
            variant={option.value === value ? 'primary' : 'secondary'}
            onPress={() => {
              onChange(option.value);
              setOpen(false);
            }}
          >
            {option.label}
          </Button>
        ))}
      </Sheet>
    </View>
  );
}
const NoticeContext = createContext<(message: string) => void>(() => {});
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 4000);
    return () => clearTimeout(timer);
  }, [message]);
  return (
    <NoticeContext.Provider value={setMessage}>
      {children}
      {message ? (
        <Pressable
          onPress={() => setMessage('')}
          accessibilityLiveRegion="polite"
          style={{
            position: 'absolute',
            bottom: 32,
            left: 20,
            right: 20,
            backgroundColor: '#29241f',
            borderRadius: 16,
            padding: 18,
          }}
        >
          <Txt style={{ color: 'white' }}>{message}</Txt>
        </Pressable>
      ) : null}
    </NoticeContext.Provider>
  );
}
export const useNotice = () => useContext(NoticeContext);
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const locked = useRef(false);
  const notice = useNotice();
  async function run<T>(
    work: () => Promise<T>,
    success?: string,
  ): Promise<T | undefined> {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await work();
      if (success) notice(success);
      return result;
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      setError(error);
      notice(error.message);
      return undefined;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    gap: 13,
    boxShadow: '0px 4px 20px rgba(72, 40, 8, 0.055)',
  },
  input: {
    minHeight: 50,
    borderRadius: 15,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee4da',
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
  },
});
