const Constants = {
    AND: 'AND',
    OR: 'OR',
    IN: 'IN',
    BETWEEN: 'BETWEEN',
    NOT: 'NOT',
    NOT_EQUAL: '<>',
    EQUAL: '='
};

// constants for parsing different selector formats
const BalanceSheet = {
    KEY_NAME: ['MIS_ACCOUNT_TYPE_KEY', 'MIS_FUND_TYPE_KEY', 'MIS_LEVEL_2_KEY', 'MIS_LEVEL_3_KEY'],
    EXCLUDE_DELIMITER: /[\(\)\[\]]/,

    ACCOUNT_LEN: 5,
    NUMBER_BASE: 10,
    MAX_DEPTH: 4,

    KEY_LEN: [1, 1, 1, 2],
    KEY_RANGE: [10, 10, 10, 100],
    START_POS: [0, 1, 2, 3],

    PLACEHOLDER: '~'
};

const PrimaryAccount = {

}

const SecondaryAccount = {

}

// ------------------------------------------------------------------------------

const getDepth = (x) => (x-3)/2+3

const pad = (num, size) => {
    let s = String(num);
    while(s.length < size) s="0"+s;
    return s;
}

const match = (selector, pattern) => {
    for(let i=0;i<selector.length;i++){
        if(selector[i]!='~'&&selector[i]!=pattern[i]) return false;
    }
    return true;
}

const arrayEquals = (a, b) => {
    if (a.length != b.length) return false;
    for (let i=0;i<a.length;i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

class QueryPath {
    constructor(selector, format) {
        this.path = [];
        for (let i=0;i<getDepth(selector.length);i++){
            this.path.push([]);
            const sub = selector.substr(format.START_POS[i], format.KEY_LEN[i]);
            for(let j=0;j<format.KEY_RANGE[i];j++){
                if(match(sub, pad(j, format.KEY_LEN[i]))){
                    this.path[i].push(j);
                }
            }
        }
    }
    // determines if two QueryPaths can be merged at index
    similar(other, index) {
        for(let i=0;i<this.path.length;i++){
            if(i != index && !arrayEquals(this.path[i], other.path[i])) return false;
        }
        return true;
    }
}

const expand = (selector, format) => {
    if (selector.endsWith('*')){
        if (format.ACCOUNT_LEN-selector.length+1 < 0) {
            // throw ArgumentError;
            alert('Argument Length invalid.');
        }
        else selector = selector.replace('*', format.PLACEHOLDER.repeat(format.ACCOUNT_LEN-selector.length+1));
    }
    else if (selector.length != format.ACCOUNT_LEN) {
        // throw ArgumentError;
        alert('Argument Length invalid.');
    }
    return selector;
}

const replace = (str, idx, ch) => str.substring(0, idx) + ch + str.substring(idx+1);

const add = (str, idx, val) => {
    let carry = val;
    for (let i=idx;i>=0;i--) {
        if(str[i]=='~') continue;
        let cur = str[i]-'0'+carry;
        str = replace(str, i, (cur+10)%10);
        if(cur<0) carry=-1;
        else if(cur>9) carry=1;
        else carry=0;
    }
    if (carry == 1) str = '1' + str;
    while (str[0] == '0') str = str.substring(1);
    return str;
}

const less = (a, b) => {
    if (a.length != b.length) return a.length < b.length;
    else return a <= b;
}

const parse_token = (token, acc, format) => {
    if(token) {
        if(token.includes('to')) {
            // create multiple selectors to cover range (like segment tree except less efficient D: )
            let [from, to] = token.split('to').map(token => token.trim());
            let prefix = (from.length < to.length)? from.length : to.length;
            from = expand(from, format);
            to = expand(to, format);

            let lcs = '';
            while(from.length && from.slice(-1) == to.slice(-1)) {
                lcs = from.slice(-1) + lcs;
                from = from.slice(0,-1);
                to = to.slice(0,-1);
            }

            for (let i=prefix-1;i<from.length;i++) {
                if (from[i] == '~' && to[i] != '~') from = replace(from, i, '0');
                if (to[i] == '~' && from[i] != '~') to = replace(to, i, '9');
            }

            for (let i=0;i<from.length;i++) {
                // there's ambiguity if internal wildcards don't match, so just throw an error if this happens
                // throw ArgumentError;
                if ((from[i] == '~' && to[i] != '~') || (to[i] == '~' && from[i] != '~')){
                    alert('Internal wildcards mismatch in \'to\' selector');
                }
            }

            while (less(from, to)) {
                let idx = 0;
                for (let i=from.length-1;i>=0;i--) {
                    if (from[i] != '~' && from[i] != '0') {
                        idx = i;
                        break;
                    }
                }
                for (let i=idx;i<from.length;i++) {
                    let next = add(add(from, from.length-1, -1), i, 1);
                    if (less(next, to)) {
                        for (let j=i+1;j<from.length;j++) from = replace(from, j, '~');
                        acc.push(from+lcs);
                        from = add(next, next.length-1, 1);
                        break;
                    }
                }
            }

        }
        else{
            const pat = token.trim();
            acc.push(expand(pat, format));
        }
    }
    return acc;
}

const parse_query = (code, format) => {
    const segments = code.split(format.EXCLUDE_DELIMITER);

    let include_segments = [];
    let exclude_segments = [];

    for(let i=0;i<segments.length;i++){
        if(i&1) exclude_segments.push(segments[i]);
        else include_segments.push(segments[i]);
    }

    const include_tokens = include_segments.reduce(
        (acc, cur) => acc.concat(cur.split(',')), []
    );
    const exclude_tokens = exclude_segments.reduce(
        (acc, cur) => acc.concat(cur.split(',')), []
    );

    const include_selectors = include_tokens.reduce(
        (acc, cur) => parse_token(cur, acc, format), []
    );
    const exclude_selectors = exclude_tokens.reduce(
        (acc, cur) => parse_token(cur, acc, format), []
    );

    return {
        include_selectors,
        exclude_selectors
    };
}

const keyNameWrapper = (keyName) => {
    return `ltrim(rtrim(${keyName}))`;
}

// generate an expression for [KEY_NAME] IN {}, operation
const generateSetExp = (depth, set, format, negate = false) => {
    // for now we do a simple optimization: if the set elements form a contiguous interval, we use BETWEEN instead of IN
    // also, if the set is a single element, we use '='

    // TODO: Add processing for each interval separately and apply BETWEEN if better for said interval and ( OR ) to chain them <-----------------------------
    const keyName = format.KEY_NAME[depth];
    const keyLen = format.KEY_LEN[depth];
    let min = Number.MAX_SAFE_INTEGER, max = 0;
    for (let i=0;i<set.length;i++) {
        min = (min > set[i])? set[i] : min;
        max = (max < set[i])? set[i] : max;
    }
    if(max-min+1 == set.length) {
        if (min == max) return `${keyNameWrapper(keyName)}${negate ? Constants.NOT_EQUAL : Constants.EQUAL}'${pad(min, keyLen)}'`;
        else{
            const exp1 = ` ${Constants.BETWEEN} '${pad(min, keyLen)}' ${Constants.AND} '${pad(max, keyLen)}'`;
            const exp2 = ` ${Constants.IN} (${set.map(elem => `'${pad(elem, keyLen)}'`).join(',')})`;
            return `${keyNameWrapper(keyName)}${negate ? ` ${Constants.NOT}` : ''}` + ((exp1.length<exp2.length)? exp1 : exp2);
        }
    }
    else return `${keyNameWrapper(keyName)} ${negate ? `${Constants.NOT} ` : ''}${Constants.IN} (${set.map(elem => `'${pad(elem, keyLen)}'`).join(',')})`;
}

// returns union of arrays a and b
const union = (a, b) => [...new Set([...a, ...b])].sort()

// returns intersection of arrays a and b
const intersect = (a, b) => a.filter(e => b.includes(e))

// creates query in nested tree-like structure
/*
const dfs = (depth, paths, format) => {
    if (depth == format.MAX_DEPTH || paths.length == 0) return { childexp: '', childchildnum: 0 };
    let exp = '', childnum = 0;
    let children = {};
    for (let i=0;i<paths.length;i++) {
        const path = paths[i];
        if (!children.hasOwnProperty(path.path[depth])){
            children[path.path[depth]] = [];
        }
        children[path.path[depth]].push(path);
    }
    for (let transition in children) {
        // format of each child branch is:  [transition] [transition&&child&&' AND '] ([child])
        const child = children[transition];
        let { childexp, childchildnum } = dfs(depth+1, child, format);

        const trans = [...transition.split(',').map(token => parseInt(token))];

        if (trans.length == format.KEY_RANGE[depth]) {
            // 'universal' selector, we do not need to specify 'in'
            if (childexp.length > 0) {
                if (exp.length > 0) exp = exp + ` ${Constants.OR} `;
                exp = exp + childexp;
                childnum ++;
            }
        }
        else {
            if (childexp.length > 0) {
                if (exp.length > 0) exp = exp + ` ${Constants.OR} `;
                if (childchildnum > 1) childexp = '(' + childexp + ')';
                exp = exp + generateSetExp(depth, trans, format) + ` ${Constants.AND} ` + childexp;
            }
            else {
                if(exp.length > 0) exp = exp + ` ${Constants.OR} `;
                exp = exp + generateSetExp(depth, trans, format);
            }
            childnum ++;
        }
    }
    return {
        childexp: exp,
        childchildnum: childnum
    };
}
*/

const dfs = (depth, include, exclude, format) => {
    // if we have processed all keys or the current scope is empty
    if (depth == format.MAX_DEPTH || include.length+exclude.length == 0) return { childexp: '', childchildnum: 0 };
    let inc_exp = '', neg_exp = '', childnum = 0;
    let children = {};
    include,concat(exclude).forEach(path => {
        if (!children.hasOwnProperty(path.path[depth])) children[path.path[depth]] = [];
        children[path.path[depth]].push(path);
    });
    let global_negate = exclude.filter(elem => {
        let cnt = 0;
        for (let transition in children) {
            const trans = [...transition.split(',').map(token => parseInt(token))];
            if (intersect(elem.path[depth], trans).length > 0) cnt ++;
        }
        return cnt != 1;
    });
    // handle global negate elements
    for (let transition in children) {
        const child = children[transition];
        const negate = child.filter(elem => global_negate.includes(elem));
        let { childexp, childchildnum } = dfs(depth+1, [], negate, format);

        const trans = [...transition.split(',').map(token => parseInt(token))];

        if (trans.length == format.KEY_RANGE[depth]) {

        }
        
    }
    for (let transition in children) {
        // format of each child branch is:  [transition] [transition&&child&&' AND '] ([child])
        const child = children[transition];
        const child_include = child.filter(elem => include.includes(elem));
        const child_exclude = child.filter(elem => exclude.includes(elem) && !global_negate.includes(elem));
        let { childexp, childchildnum } = dfs(depth+1, child_include, child_exclude, format);

        const trans = [...transition.split(',').map(token => parseInt(token))];

        if (trans.length == format.KEY_RANGE[depth]) {
            // 'universal' selector, we do not need to specify 'in'
            if (childexp.length > 0) {
                if (exp.length > 0) exp = exp + ` ${Constants.OR} `;
                exp = exp + childexp;
                childnum ++;
            }
        }
        else {
            if (childexp.length > 0) {
                if (exp.length > 0) exp = exp + ` ${Constants.OR} `;
                if (childchildnum > 1) childexp = '(' + childexp + ')';
                exp = exp + generateSetExp(depth, trans, format) + ` ${Constants.AND} ` + childexp;
            }
            else {
                if(exp.length > 0) exp = exp + ` ${Constants.OR} `;
                exp = exp + generateSetExp(depth, trans, format);
            }
            childnum ++;
        }
    }
    return {
        childexp: exp,
        childchildnum: childnum
    };
}

const generate_expression = (selectors, format) => {
    let paths = selectors.map(selector => new QueryPath(selector, format));
    
    for (let i=format.MAX_DEPTH-1;i>=0;i--) {
        let result = [];
        for (let j=0;j<paths.length;j++) {
            let done = false;
            for (let k=0;k<result.length;k++) {
                console.log()
                if (result[k].similar(paths[j], i)) {
                    result[k].path[i] = union(result[k].path[i], paths[j].path[i]);
                    done = true;
                    break;
                }
            }
            if (!done) {
                result.push(paths[j]);
            }
        }
        paths = result;
    }

    console.log(paths);
    const { childexp: expression } = dfs(0, paths, format);

    return expression;
}

const negate_expression = (expression) => {
    // change and to or, or to and, = to <>, and in {} to in {}'

    return `${Constants.NOT} (${expression})`;
}

const generate_query = (code, parseFormat) => {
    const { include_selectors, exclude_selectors } = parse_query(code, parseFormat);

    console.log(include_selectors);
    console.log(exclude_selectors);

    const include_exp = generate_expression(include_selectors, parseFormat);
    const exclude_exp = generate_expression(exclude_selectors, parseFormat);

    if (exclude_exp) return include_exp.concat(` ${Constants.AND} `, negate_expression(exclude_exp));
    else return include_exp;
}

const QUERY = '3* to 9*';

// generate_query('4* [45100, 460*, 465*, 466*], 5* [560*, 565*, 566*], 6* [62800, 63030, 665*, 69571, 69700], 7* [72000, 75000, 75500, 76000, 78000], 8*, 9* [950*, 95500]', BalanceSheet);
console.log(generate_query(QUERY, BalanceSheet));