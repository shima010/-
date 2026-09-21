"""PDF to Excel Converter の画面版。

コマンド操作をせずに、ファイルを選んでボタンを押すだけで変換できます。
起動:  python gui.py
"""

from __future__ import annotations

import queue
import sys
import threading
from pathlib import Path

try:
    import tkinter as tk
    from tkinter import filedialog, messagebox, ttk
except ImportError:  # pragma: no cover - tkinter未同梱のPython向け
    print(
        "この環境のPythonには tkinter が含まれていないため、画面版を起動できません。\n"
        "コマンド版をお使いください:  python pdf_to_excel.py 変換したい.pdf",
        file=sys.stderr,
    )
    sys.exit(1)

from pdf_to_excel import collect_pdfs, convert_many


class ConverterApp:
    def __init__(self, root: tk.Tk, initial_files: list[str] | None = None):
        self.root = root
        self.root.title("PDF → Excel 変換")
        self.root.geometry("760x640")
        self.root.minsize(640, 520)
        self.messages: queue.Queue[str] = queue.Queue()
        self.running = False

        self.separate_sheets = tk.BooleanVar(value=False)
        self.convert_numbers = tk.BooleanVar(value=True)
        self.output_dir = tk.StringVar(value="")

        self._build_widgets()
        if initial_files:
            self._add_paths(initial_files)
        self.root.after(100, self._drain_messages)

    # -- 画面構築 ---------------------------------------------------------
    def _build_widgets(self):
        padding = {"padx": 10, "pady": 5}

        file_frame = ttk.LabelFrame(self.root, text="変換するPDF")
        file_frame.pack(fill="both", expand=True, **padding)

        self.file_list = tk.Listbox(file_frame, selectmode="extended")
        scrollbar = ttk.Scrollbar(file_frame, orient="vertical", command=self.file_list.yview)
        self.file_list.configure(yscrollcommand=scrollbar.set)
        self.file_list.pack(side="left", fill="both", expand=True, padx=(10, 0), pady=10)
        scrollbar.pack(side="left", fill="y", pady=10)

        button_column = ttk.Frame(file_frame)
        button_column.pack(side="left", fill="y", padx=10, pady=10)
        ttk.Button(button_column, text="ファイルを追加", command=self.add_files).pack(fill="x", pady=2)
        ttk.Button(button_column, text="フォルダを追加", command=self.add_folder).pack(fill="x", pady=2)
        ttk.Button(button_column, text="選択を削除", command=self.remove_selected).pack(fill="x", pady=2)
        ttk.Button(button_column, text="すべて削除", command=self.clear_files).pack(fill="x", pady=2)

        option_frame = ttk.LabelFrame(self.root, text="オプション")
        option_frame.pack(fill="x", **padding)
        ttk.Checkbutton(option_frame, text="ページごとに別シートに分ける",
                        variable=self.separate_sheets).grid(row=0, column=0, sticky="w", padx=10, pady=4)
        ttk.Checkbutton(option_frame, text="数字をExcelの数値に変換する（合計できる形にする）",
                        variable=self.convert_numbers).grid(row=1, column=0, sticky="w", padx=10, pady=4)

        output_row = ttk.Frame(option_frame)
        output_row.grid(row=2, column=0, sticky="we", padx=10, pady=4)
        ttk.Label(output_row, text="出力先フォルダ:").pack(side="left")
        ttk.Entry(output_row, textvariable=self.output_dir, width=50).pack(side="left", padx=5)
        ttk.Button(output_row, text="選択", command=self.choose_output_dir).pack(side="left")
        ttk.Label(option_frame, text="（未指定の場合は元のPDFと同じフォルダに出力します）").grid(
            row=3, column=0, sticky="w", padx=10)

        action_frame = ttk.Frame(self.root)
        action_frame.pack(fill="x", **padding)
        self.convert_button = ttk.Button(action_frame, text="変換を実行", command=self.start_conversion)
        self.convert_button.pack(side="left")
        ttk.Button(action_frame, text="閉じる", command=self.root.destroy).pack(side="right")

        log_frame = ttk.LabelFrame(self.root, text="実行ログ")
        log_frame.pack(fill="both", expand=True, **padding)
        self.log = tk.Text(log_frame, height=8, state="disabled", wrap="word")
        log_scroll = ttk.Scrollbar(log_frame, orient="vertical", command=self.log.yview)
        self.log.configure(yscrollcommand=log_scroll.set)
        self.log.pack(side="left", fill="both", expand=True, padx=(10, 0), pady=10)
        log_scroll.pack(side="left", fill="y", pady=10)

    # -- ファイル一覧 -----------------------------------------------------
    def _add_paths(self, paths):
        existing = set(self.file_list.get(0, "end"))
        for path in paths:
            text = str(path)
            if text not in existing:
                self.file_list.insert("end", text)
                existing.add(text)

    def add_files(self):
        paths = filedialog.askopenfilenames(
            title="変換するPDFを選択", filetypes=[("PDFファイル", "*.pdf"), ("すべて", "*.*")]
        )
        self._add_paths(paths)

    def add_folder(self):
        folder = filedialog.askdirectory(title="PDFの入ったフォルダを選択")
        if folder:
            pdfs = collect_pdfs([folder])
            if not pdfs:
                messagebox.showinfo("PDF to Excel", "そのフォルダにPDFが見つかりませんでした。")
                return
            self._add_paths(pdfs)

    def remove_selected(self):
        for index in reversed(self.file_list.curselection()):
            self.file_list.delete(index)

    def clear_files(self):
        self.file_list.delete(0, "end")

    def choose_output_dir(self):
        folder = filedialog.askdirectory(title="出力先フォルダを選択")
        if folder:
            self.output_dir.set(folder)

    # -- 変換処理 ---------------------------------------------------------
    def start_conversion(self):
        if self.running:
            return
        files = list(self.file_list.get(0, "end"))
        if not files:
            messagebox.showwarning("PDF to Excel", "変換するPDFを追加してください。")
            return

        # tkinterの変数はメインスレッドでのみ読めるため、ここで値を取り出しておく
        options = {
            "output_dir": self.output_dir.get().strip() or None,
            "separate_sheets": self.separate_sheets.get(),
            "convert_numbers": self.convert_numbers.get(),
        }

        self.running = True
        self.convert_button.state(["disabled"])
        self._write_log("=== 変換を開始します ===")
        worker = threading.Thread(
            target=self._run_conversion, args=(files, options), daemon=True
        )
        worker.start()

    def _run_conversion(self, files: list[str], options: dict):
        try:
            succeeded, errors = convert_many(
                files,
                output_dir=options["output_dir"],
                separate_sheets=options["separate_sheets"],
                convert_numbers=options["convert_numbers"],
                log=self.messages.put,
            )
            self.messages.put(f"=== 完了: 成功 {len(succeeded)}件 / 失敗 {len(errors)}件 ===")
            self.messages.put(("DONE", len(succeeded), len(errors)))
        except Exception as e:  # 想定外でも画面を固まらせない
            self.messages.put(f"予期しないエラー: {e}")
            self.messages.put(("DONE", 0, 1))

    def _drain_messages(self):
        while True:
            try:
                item = self.messages.get_nowait()
            except queue.Empty:
                break
            if isinstance(item, tuple) and item and item[0] == "DONE":
                self.running = False
                self.convert_button.state(["!disabled"])
                _, ok, ng = item
                if ng:
                    messagebox.showwarning(
                        "PDF to Excel", f"変換が終わりました。\n成功 {ok}件 / 失敗 {ng}件\n"
                        "詳細は実行ログを確認してください。")
                else:
                    messagebox.showinfo("PDF to Excel", f"変換が終わりました。（{ok}件）")
            else:
                self._write_log(str(item))
        self.root.after(150, self._drain_messages)

    def _write_log(self, text: str):
        self.log.configure(state="normal")
        self.log.insert("end", text + "\n")
        self.log.see("end")
        self.log.configure(state="disabled")


def main():
    initial = [arg for arg in sys.argv[1:] if Path(arg).exists()]
    root = tk.Tk()
    ConverterApp(root, initial)
    root.mainloop()


if __name__ == "__main__":
    main()
