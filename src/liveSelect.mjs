import { AsyncResource } from 'node:async_hooks';
import {
  Separator,
  ValidationError,
  createPrompt,
  isBackspaceKey,
  isDownKey,
  isEnterKey,
  isNumberKey,
  isUpKey,
  makeTheme,
  useEffect,
  useKeypress,
  useMemo,
  usePagination,
  usePrefix,
  useRef,
  useState
} from '@inquirer/core';
import ansiEscapes from 'ansi-escapes';
import figures from '@inquirer/figures';
import colors from 'yoctocolors-cjs';

// Same chrome as @inquirer/select, plus a preamble and a refresh subscription.
// A refresh swaps choices and preamble in place. The highlighted value is kept.
// `aliases` names the value to land on when the highlighted value disappeared
// (the main menu's update row changes value when an install appears).
const selectTheme = {
  icon: { cursor: figures.pointer },
  style: {
    disabled: (text) => colors.dim(`- ${text}`),
    description: (text) => colors.cyan(text)
  },
  helpMode: 'auto'
};

function isSelectable (item) {
  return !Separator.isSeparator(item) && !item.disabled;
}

function normalizeChoices (choices) {
  return choices.map((choice) => {
    if (Separator.isSeparator(choice)) return choice;

    if (typeof choice === 'string') {
      return {
        value: choice,
        name: choice,
        short: choice,
        disabled: false
      };
    }

    const name = choice.name ?? String(choice.value);
    return {
      value: choice.value,
      name,
      description: choice.description,
      short: choice.short ?? name,
      disabled: choice.disabled ?? false
    };
  });
}

function resolveIndex (items, preferred, aliases) {
  const match = (value) => items.findIndex((item) => isSelectable(item) && item.value === value);
  let index = preferred == null || preferred === '' ? -1 : match(preferred);

  if (index < 0 && preferred != null && Object.prototype.hasOwnProperty.call(aliases, preferred)) {
    index = match(aliases[preferred]);
  }

  if (index < 0) index = items.findIndex(isSelectable);
  return index;
}

function viewKey (preamble, items) {
  const rows = items.map((item) => {
    if (Separator.isSeparator(item)) return `sep:${item.separator}`;
    return `c:${String(item.value)}\t${item.name}\t${item.description ?? ''}\t${item.disabled ? 1 : 0}`;
  });
  return `${preamble}\n${rows.join('\n')}`;
}

const liveSelect = createPrompt((config, done) => {
  const { loop = true, aliases = {} } = config;
  const firstRender = useRef(true);
  const theme = makeTheme(selectTheme, config.theme);
  const [status, setStatus] = useState('pending');
  const statusRef = useRef(status);
  statusRef.current = status;
  const searchTimeoutRef = useRef(undefined);
  const tickRef = useRef(0);
  const [tick, setTick] = useState(0);
  const activeRef = useRef(-1);
  const valueRef = useRef(undefined);
  const seenTick = useRef(-1);
  const snapRef = useRef(null);
  const snapshotRef = useRef(() => '');

  const items = useMemo(() => normalizeChoices(config.readChoices()), [tick]);
  const bounds = useMemo(() => {
    const first = items.findIndex(isSelectable);
    const last = items.findLastIndex(isSelectable);
    if (first < 0) {
      throw new ValidationError('[select prompt] No selectable choices. All choices are disabled.');
    }
    return { first, last };
  }, [items]);

  if (seenTick.current !== tick) {
    const preferred = seenTick.current === -1 ? config.default : valueRef.current;
    activeRef.current = resolveIndex(items, preferred, aliases);
    seenTick.current = tick;
  }

  const active = activeRef.current;
  const selectedChoice = items[active];
  valueRef.current = selectedChoice.value;

  const pageSize = config.pageSize ?? items.length;
  const readPreamble = () => (typeof config.preamble === 'function' ? config.preamble() : '');

  snapshotRef.current = () => viewKey(readPreamble(), normalizeChoices(config.readChoices()));
  if (snapRef.current == null) snapRef.current = snapshotRef.current();

  const moveTo = (index) => {
    activeRef.current = index;
    valueRef.current = items[index].value;
    tickRef.current += 1;
    setTick(tickRef.current);
  };

  useKeypress((key, rl) => {
    clearTimeout(searchTimeoutRef.current);

    if (isEnterKey(key)) {
      setStatus('done');
      done(items[activeRef.current].value);
    } else if (isUpKey(key) || isDownKey(key)) {
      rl.clearLine(0);
      const cursor = activeRef.current;
      if (
        loop ||
        (isUpKey(key) && cursor !== bounds.first) ||
        (isDownKey(key) && cursor !== bounds.last)
      ) {
        const offset = isUpKey(key) ? -1 : 1;
        let next = cursor;
        do {
          next = (next + offset + items.length) % items.length;
        } while (!isSelectable(items[next]));
        moveTo(next);
      }
    } else if (isNumberKey(key)) {
      rl.clearLine(0);
      const position = Number(key.name) - 1;
      const item = items[position];
      if (item != null && isSelectable(item)) moveTo(position);
    } else if (isBackspaceKey(key)) {
      rl.clearLine(0);
    } else {
      const searchTerm = rl.line.toLowerCase();
      const matchIndex = items.findIndex((item) => {
        if (Separator.isSeparator(item) || !isSelectable(item)) return false;
        return item.name.toLowerCase().startsWith(searchTerm);
      });
      if (matchIndex >= 0) moveTo(matchIndex);
      searchTimeoutRef.current = setTimeout(() => {
        rl.clearLine(0);
      }, 700);
    }
  });

  useEffect(() => {
    let closed = false;
    const refresh = AsyncResource.bind(() => {
      if (closed || statusRef.current === 'done') return;
      const next = snapshotRef.current();
      if (next === snapRef.current) return;
      snapRef.current = next;
      tickRef.current += 1;
      setTick(tickRef.current);
    });
    const unsubscribe = config.subscribe?.(refresh);
    return () => {
      closed = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  useEffect(() => () => {
    clearTimeout(searchTimeoutRef.current);
  }, []);

  const page = usePagination({
    items,
    active,
    renderItem ({ item, isActive }) {
      if (Separator.isSeparator(item)) return ` ${item.separator}`;

      if (item.disabled) {
        const disabledLabel = typeof item.disabled === 'string' ? item.disabled : '(disabled)';
        return theme.style.disabled(`${item.name} ${disabledLabel}`);
      }

      const color = isActive ? theme.style.highlight : (text) => text;
      const cursor = isActive ? theme.icon.cursor : ' ';
      return color(`${cursor} ${item.name}`);
    },
    pageSize,
    loop
  });

  const prefix = usePrefix({ theme });
  const preamble = readPreamble();

  if (status === 'done') {
    return `${preamble}${prefix} ${theme.style.message(config.message)} ${theme.style.answer(selectedChoice.short)}`;
  }

  const message = theme.style.message(config.message);
  let helpTipTop = '';
  let helpTipBottom = '';

  if (theme.helpMode === 'always' || (theme.helpMode === 'auto' && firstRender.current)) {
    firstRender.current = false;
    if (items.length > pageSize) {
      helpTipBottom = `\n${theme.style.help('(Use arrow keys to reveal more choices)')}`;
    } else {
      helpTipTop = theme.style.help('(Use arrow keys)');
    }
  }

  const choiceDescription = selectedChoice.description
    ? `\n${theme.style.description(selectedChoice.description)}`
    : '';

  return `${preamble}${[prefix, message, helpTipTop].filter(Boolean).join(' ')}\n${page}${helpTipBottom}${choiceDescription}${ansiEscapes.cursorHide}`;
});

export default liveSelect;
