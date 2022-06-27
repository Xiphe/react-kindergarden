import {
  createContext,
  Dispatch,
  memo,
  ReactElement,
  SetStateAction,
  useEffect,
  useState,
} from 'react';
import Kindergarten, {
  KindergartenContext,
  SetData,
  useKindergarten,
  useUpdate,
} from './Kindergarten';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

function createRegistry<Data = undefined>() {
  const entries: (Data | null)[] = [];
  return {
    entries,
    onAdd() {
      entries.push(null);
    },
    onUpdate(index: number, entry: Data) {
      entries.splice(index, 1, entry);
    },
    onRemove(index: number) {
      entries.splice(index, 1);
    },
  };
}

describe('Kindergarten', () => {
  it('throws when child is rendered outside of Kindergarten', () => {
    const Child = () => {
      useKindergarten();
      return null;
    };

    expect(() => {
      jest.spyOn(console, 'error').mockImplementationOnce(() => {});
      create(<Child />);
    }).toThrowError('Can not useKindergarten outside of <Kindergarten>');
  });

  it('does not throw when kindergarten is optional', () => {
    const Child = () => {
      useKindergarten({ optional: true });
      return null;
    };

    let root: ReactTestRenderer;
    act(() => {
      expect(() => {
        root = create(<Child />);
      }).not.toThrow();
    });

    act(() => {
      root.unmount();
    });
  });

  it('hold reference to nested child', () => {
    const registry = createRegistry<ReactElement<{}, 'li'>>();
    const Child = () => {
      return <li ref={useKindergarten<HTMLLIElement>()}>Hi</li>;
    };

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarten {...registry}>
          <ul>
            <Child />
          </ul>
        </Kindergarten>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      { type: 'li', props: { children: 'Hi' } },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  it('holds reference to nested children with data', () => {
    type Data = { ref?: HTMLLIElement | null; text?: string };
    const registry = createRegistry<Data>();
    const Child = ({ children }: { children: string }) => {
      const update = useKindergarten<Data>();
      useEffect(() => {
        update({ ...update.current, text: children });
      }, [update, children]);
      return (
        <li ref={(ref) => update({ ...update.current, ref })}>{children}</li>
      );
    };

    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <Kindergarten {...registry}>
          <ul>
            <Child>Hi</Child>
          </ul>
          <ul>
            <li>
              <ul>
                <Child>Ho</Child>
              </ul>
            </li>
          </ul>
        </Kindergarten>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      { ref: { type: 'li', props: { children: 'Hi' } }, text: 'Hi' },
      { ref: { type: 'li', props: { children: 'Ho' } }, text: 'Ho' },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  it('uses custom context with typed data', () => {
    type Data = { $el?: HTMLButtonElement | null; cool?: boolean };
    const context = createContext<KindergartenContext<Data> | null>(null);
    const registry = createRegistry<Data>();

    (function tsErrors() {
      let _: any = () => {
        const update = useKindergarten({ context });
        // @ts-expect-error
        return <li ref={($el) => update({ $el })} />;
      };
      _ = () => {
        const update = useKindergarten({ context });
        // @ts-expect-error
        update({ cool: 'yes' });
        return null;
      };
      const wrongDataType = createRegistry<{
        $el?: HTMLButtonElement | null;
        cool?: number;
      }>();
      // @ts-expect-error
      _ = <Kindergarten {...wrongDataType} context={context} />;

      const wrongElementType = createRegistry<{
        $el?: HTMLDivElement | null;
        cool?: number;
      }>();
      // @ts-expect-error
      _ = <Kindergarten {...wrongElementType} context={context} />;
    })();

    let update: SetData<Data> | null = null;
    const Child = ({ children }: { children: string }) => {
      const u = useKindergarten({ context });
      update = update || u;

      return (
        <button ref={($el) => u({ ...u.current, $el })}>{children}</button>
      );
    };
    let root: ReactTestRenderer;
    act(() => {
      root = create(
        <ul>
          <Kindergarten {...registry} context={context}>
            <Child>Hi</Child>
            <Child>Ho</Child>
          </Kindergarten>
        </ul>,
        {
          createNodeMock: (el) => el,
        },
      );
    });

    expect(registry.entries).toEqual([
      {
        $el: { type: 'button', props: { children: 'Hi' } },
      },
      {
        $el: { type: 'button', props: { children: 'Ho' } },
      },
    ]);

    act(() => {
      update!({ ...update!.current, cool: false });
    });

    expect(registry.entries).toEqual([
      {
        $el: { type: 'button', props: { children: 'Hi' } },
        cool: false,
      },
      {
        $el: { type: 'button', props: { children: 'Ho' } },
      },
    ]);

    act(() => {
      root.unmount();
    });

    expect(registry.entries).toEqual([]);
  });

  describe('events', () => {
    it('calls onAdd, onUpdate and onRemove for each child', () => {
      const addCb = jest.fn();
      const removeCb = jest.fn();
      const updateCb = jest.fn();
      const Child = ({ children }: { children: string }) => (
        <li ref={useKindergarten()}>{children}</li>
      );

      let root: ReactTestRenderer;
      act(() => {
        root = create(
          <Kindergarten onAdd={addCb} onRemove={removeCb} onUpdate={updateCb}>
            <ul>
              <Child>Hi</Child>
              <Child>Ho</Child>
            </ul>
          </Kindergarten>,
          {
            createNodeMock: (el) => el,
          },
        );
      });

      expect(addCb).toHaveBeenCalledTimes(2);
      expect(updateCb).toHaveBeenCalledTimes(2);
      expect(updateCb.mock.calls[0]).toEqual([
        0,
        { props: { children: 'Hi' }, type: 'li' },
      ]);
      expect(updateCb.mock.calls[1]).toEqual([
        1,
        { props: { children: 'Ho' }, type: 'li' },
      ]);
      expect(removeCb).not.toHaveBeenCalled();

      act(() => {
        root.unmount();
      });

      expect(addCb).toHaveBeenCalledTimes(2);
      expect(updateCb).toHaveBeenCalledTimes(4);
      expect(updateCb.mock.calls[2]).toEqual([0, null]);
      expect(updateCb.mock.calls[3]).toEqual([1, null]);
      expect(removeCb).toHaveBeenCalledTimes(2);
    });
  });

  describe('update', () => {
    it('throws used outside of Kindergarten', () => {
      const Child = () => {
        useUpdate([]);
        return null;
      };

      expect(() => {
        jest.spyOn(console, 'error').mockImplementationOnce(() => {});
        create(<Child />);
      }).toThrowError('Can not useUpdate outside of <Kindergarten>');
    });

    it('updates registry order when children are sorted', () => {
      const registry = createRegistry<ReactElement<{}, 'li'>>();
      const Child = memo(({ children }: { children: string }) => (
        <li ref={useKindergarten()}>{children}</li>
      ));
      let setChildren: Dispatch<SetStateAction<string[]>>;
      const Sorter = () => {
        const [texts, sc] = useState<string[]>(['Hi', 'Ho']);
        useUpdate([texts]);
        setChildren = sc;
        return (
          <ul>
            {texts.map((t) => (
              <Child key={t}>{t}</Child>
            ))}
          </ul>
        );
      };

      let root: ReactTestRenderer;
      act(() => {
        root = create(
          <Kindergarten {...registry}>
            <Sorter />
          </Kindergarten>,
          {
            createNodeMock: (el) => el,
          },
        );
      });

      expect(registry.entries).toEqual([
        { type: 'li', props: { children: 'Hi' } },
        { type: 'li', props: { children: 'Ho' } },
      ]);

      act(() => {
        setChildren!(['Ho', 'Hi']);
      });

      expect(root!.toJSON()).toMatchInlineSnapshot(`
          <ul>
            <li>
              Ho
            </li>
            <li>
              Hi
            </li>
          </ul>
        `);

      expect(registry.entries).toEqual([
        { type: 'li', props: { children: 'Ho' } },
        { type: 'li', props: { children: 'Hi' } },
      ]);

      act(() => {
        root.unmount();
      });

      expect(registry.entries).toEqual([]);
    });
  });
});
