import {
  Context,
  createContext,
  ReactNode,
  RefCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface Kind<RefType, Data = never> {
  ref: RefType | null;
  data?: Data;
}

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

export interface KindergardenRegistry<RefType, Data = never> {
  add(kind: Kind<RefType, Data>): void;
  update(kind: Kind<RefType, Data>): void;
  remove(kind: Kind<RefType, Data>): void;
}
export interface CreatedRegistry<RefType, Data = never>
  extends KindergardenRegistry<RefType, Data> {
  entries: Kind<RefType, Data>[];
  hooks: RegistryHooks<RefType, Data>;
}
export interface RegistryHooks<RefType, Data = never> {
  add?(entry: Kind<RefType, Data>): void;
  remove?(index: number): void;
  update?(index: number, entry: Kind<RefType, Data>): void;
}
export function createRegistry<RefType, Data = never>(
  hooks: RegistryHooks<RefType, Data> = {},
): CreatedRegistry<RefType, Data> {
  const state: Kind<RefType, Data>[] = [];
  return {
    hooks,
    get entries() {
      return [...state];
    },
    add(entry) {
      state.push(entry);
      hooks.add?.(entry);
    },
    update(entry) {
      if (hooks.update) {
        const index = state.indexOf(entry);
        if (index !== -1) {
          hooks.update(index, entry);
        }
      }
    },
    remove(entry) {
      const index = state.indexOf(entry);
      if (index !== -1) {
        state.splice(index, 1);
        hooks.remove?.(index);
      }
    },
  };
}
export function useRegistry<RefType, Data = never>(
  hooks: RegistryHooks<RefType, Data> = {},
): CreatedRegistry<RefType, Data> {
  const registry = useMemo(() => createRegistry(hooks), []);
  registry.hooks = hooks;
  return registry;
}

export interface KindergardenProps<RefType, Data = never> {
  registry?: KindergardenRegistry<RefType, Data>;
  onAdd?: (kind: Kind<RefType, Data>) => void;
  onRemove?: (index: number) => void;
  onUpdate?: (index: number, kind: Kind<RefType, Data>) => void;
  children?: ReactNode;
  context?: Context<KindergardenContext<RefType, Data> | null>;
}
export default function Kindergarden<RefType, Data = never>({
  registry: externalRegistry,
  context = DefaultKindergardenContext,
  onAdd,
  onRemove,
  onUpdate,
  children,
}: KindergardenProps<RefType, Data>) {
  const { Provider } = context;
  const internalRegistry = useMemo(
    (): CreatedRegistry<RefType, Data> => createRegistry(),
    [],
  );
  const registry = useMemo((): KindergardenRegistry<RefType, Data> => {
    if (externalRegistry) {
      if (onAdd || onRemove || onUpdate) {
        throw new Error('Can not use events and registry together');
      }
      return externalRegistry;
    }
    Object.assign(internalRegistry.hooks, {
      add: onAdd,
      remove: onRemove,
      update: onUpdate,
    });
    return internalRegistry;
  }, [internalRegistry, externalRegistry, onAdd, onRemove, onUpdate]);
  const [triggerUpdate, setTriggerUpdate] = useState<symbol>(Symbol());

  const register = useMemo<KindergardenContext<RefType, Data>>(() => {
    const callback: KindergardenContext<RefType, Data> = (data) => {
      const entry: Kind<RefType, Data> = {
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
  useEffect(() => {
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
    /* istanbul-ignore-next */
    updateData() {},
    ref() {},
    unregister() {},
  };
};
