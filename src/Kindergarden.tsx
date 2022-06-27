import type { Context, ReactNode, RefCallback } from 'react';
import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface KindergardenContext<RefType, Data = never> {
  (data?: Data): {
    updateData(data?: Data): void;
    ref: RefCallback<RefType>;
    unregister(): void;
  };
  update: () => void;
}
export const DefaultKindergardenContext = createContext<KindergardenContext<
  any,
  any
> | null>(null);

export interface Child<RefType, Data = never> {
  ref: RefType | null;
  data?: Data;
}
interface KindergardenRegistry<RefType, Data = never> {
  add(child: Child<RefType, Data>): void;
  update(child: Child<RefType, Data>): void;
  remove(child: Child<RefType, Data>): void;
  hooks: RegistryHooks<RefType, Data>;
}
export interface RegistryHooks<RefType, Data = never> {
  onAdd?(entry: Child<RefType, Data>): void;
  onRemove?(index: number): void;
  onUpdate?(index: number, entry: Child<RefType, Data>): void;
}

export interface KindergardenProps<RefType, Data = never>
  extends RegistryHooks<RefType, Data> {
  children?: ReactNode;
  context?: Context<KindergardenContext<RefType, Data> | null>;
}
export default function Kindergarden<RefType, Data = never>({
  context: { Provider } = DefaultKindergardenContext,
  onAdd,
  onRemove,
  onUpdate,
  children,
}: KindergardenProps<RefType, Data>) {
  const registry = useMemo((): KindergardenRegistry<RefType, Data> => {
    const state: Child<RefType, Data>[] = [];
    const hooks: RegistryHooks<RefType, Data> = {};
    return {
      hooks,
      add(entry) {
        state.push(entry);
        hooks.onAdd?.(entry);
      },
      update(entry) {
        if (hooks.onUpdate) {
          const index = state.indexOf(entry);
          if (index !== -1) {
            hooks.onUpdate(index, entry);
          }
        }
      },
      remove(entry) {
        const index = state.indexOf(entry);
        if (index !== -1) {
          state.splice(index, 1);
          hooks.onRemove?.(index);
        }
      },
    };
  }, []);
  registry.hooks.onAdd = onAdd;
  registry.hooks.onRemove = onRemove;
  registry.hooks.onUpdate = onUpdate;

  const [triggerUpdate, setTriggerUpdate] = useState<symbol>(Symbol());

  const register = useMemo<KindergardenContext<RefType, Data>>(() => {
    const callback: KindergardenContext<RefType, Data> = (data) => {
      const entry: Child<RefType, Data> = {
        ref: null,
        data,
      };

      registry.add(entry);

      return {
        updateData(data) {
          entry.data = data;
          registry.update(entry);
        },
        ref(element) {
          entry.ref = element;
          registry.update(entry);
        },
        unregister() {
          registry.remove(entry);
        },
      };
    };
    callback.update = () => setTriggerUpdate(Symbol());

    return callback;
  }, [triggerUpdate, registry]);

  return <Provider value={register}>{children}</Provider>;
}

export interface UseUpdateProps {
  context?: Context<KindergardenContext<any, any> | null>;
  ignoreInitial?: boolean;
}
export function useUpdate(
  dependencies: any[],
  {
    context = DefaultKindergardenContext,
    ignoreInitial = true,
  }: UseUpdateProps = {},
) {
  const register = useContext(context);
  const isInitial = useRef(ignoreInitial);
  if (!register) {
    throw new Error('Can not useUpdate outside of <Kindergarden>');
  }
  useLayoutEffect(() => {
    if (isInitial.current) {
      isInitial.current = false;
      return;
    }
    register.update();
  }, dependencies);
}

export interface UseKindergardenProps<RefType, Data = never> {
  data?: Data;
  context?: Context<KindergardenContext<RefType, Data> | null>;
  optional?: boolean;
}
export function useKindergarden<RefType, Data = never>({
  data,
  context = DefaultKindergardenContext,
  optional,
}: UseKindergardenProps<RefType, Data> = {}): RefCallback<RefType> | undefined {
  const register = useContext(context) || noopRegister;

  if (register === noopRegister && !optional) {
    throw new Error('Can not useKindergarden outside of <Kindergarden>');
  }

  const initial = useRef(true);
  const { ref, unregister, updateData } = useMemo(() => {
    initial.current = true;
    return register(data);
  }, [register]);
  useLayoutEffect(() => {
    if (initial.current) {
      initial.current = false;
    } else {
      updateData(data);
    }
  }, [updateData, data]);
  useLayoutEffect(() => () => unregister(), [unregister]);
  return ref;
}

const noopRegister = () => {
  return {
    /* istanbul ignore next */
    updateData() {},
    ref() {},
    unregister() {},
  };
};
